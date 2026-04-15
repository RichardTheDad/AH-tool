from __future__ import annotations

import logging
import time

from sqlalchemy.exc import OperationalError

from app.core.config import get_settings
from app.db.init_db import purge_expired_app_data
from app.db.models import AppSettings
from app.db.session import get_session_factory
from app.services.metadata_backfill_service import queue_missing_metadata_sweep
from app.services.listing_service import mark_stale_snapshots, refresh_from_provider
from app.services.provider_service import get_provider_registry
from app.services.calibration_service import evaluate_due_predictions
from app.services.realm_service import get_all_enabled_realm_names
from app.services.scan_runtime_service import mark_scan_failed, mark_scan_finished, try_mark_scan_started


logger = logging.getLogger(__name__)


LOCK_RETRY_ATTEMPTS = 4
LOCK_RETRY_DELAY_SECONDS = 1.5


def _run_with_sqlite_lock_retry(session, operation_name: str, func):
    attempt = 0
    while True:
        attempt += 1
        try:
            return func()
        except OperationalError as exc:
            session.rollback()
            message = str(exc).lower()
            if "database is locked" in message and attempt < LOCK_RETRY_ATTEMPTS:
                delay = LOCK_RETRY_DELAY_SECONDS * attempt
                logger.info(
                    "%s hit a database lock; retrying in %.1fs (attempt %s/%s).",
                    operation_name,
                    delay,
                    attempt,
                    LOCK_RETRY_ATTEMPTS,
                )
                time.sleep(delay)
                continue
            raise


def _score_all_users(session) -> None:
    """Run a scored-opportunities scan for every registered user after a data refresh.

    Uses refresh_live=False because listing data was just fetched in this cycle.
    Errors for individual users are logged and do not abort the remaining users.
    """
    from app.schemas.scan import ScanRunRequest
    from app.services.scan_service import ScanAlreadyRunningError, run_user_scan

    user_ids = [row.user_id for row in session.query(AppSettings.user_id).all()]
    if not user_ids:
        logger.info("Skipping scheduled scoring: no registered users.")
        return

    logger.info("Running scheduled scan scoring for %d user(s).", len(user_ids))
    for user_id in user_ids:
        try:
            result = run_user_scan(session, user_id, ScanRunRequest(refresh_live=False, include_losers=False))
            logger.info("Scheduled scan for user %s completed with %d result(s).", user_id, result.result_count)
        except ScanAlreadyRunningError:
            logger.info("Skipping scheduled scan for user %s: scan already running.", user_id)
        except Exception:
            logger.exception("Scheduled scan for user %s failed; continuing with remaining users.", user_id)


def run_refresh_cycle() -> None:
    """Background data-refresh cycle.

    Fetches raw listing data for the union of all users' enabled realms and stores
    it in the shared ListingSnapshot table. Individual user scans are computed on
    demand via the API using each user's personal settings and realm list.
    """
    session = get_session_factory()()
    provider_name = get_settings().default_listing_provider
    try:
        purge_expired_app_data(session)
        mark_stale_snapshots(session)

        realms = get_all_enabled_realm_names(session)
        if not realms:
            logger.info("Skipping scheduled data refresh: no enabled realms across all users.")
            return

        provider = get_provider_registry().get_listing_provider(None)
        if not provider.supports_live_fetch:
            logger.info("Skipping scheduled data refresh: provider '%s' does not support live fetch.", provider_name)
            return

        if not try_mark_scan_started(provider_name):
            logger.info("Skipping scheduled data refresh: a refresh is already running.")
            return

        try:
            inserted, warning = refresh_from_provider(session, realms, provider_name)
            if warning:
                logger.info("Data refresh warning: %s", warning)
            else:
                logger.info("Refreshed listing data for %d realm(s) (%d rows written).", len(realms), inserted)
            mark_scan_finished(provider_name, result_count=inserted)
        except Exception:
            mark_scan_failed(provider_name, "Scheduled data refresh failed.")
            raise

        queued = queue_missing_metadata_sweep(limit=200)
        if queued:
            logger.info("Queued metadata sweep for %d unresolved item(s).", queued)

        evaluated = _run_with_sqlite_lock_retry(
            session,
            "Calibration telemetry evaluation",
            lambda: evaluate_due_predictions(session, limit=500),
        )
        if evaluated:
            logger.info("Updated %d calibration telemetry event(s).", evaluated)

        _score_all_users(session)
    except Exception:  # pragma: no cover - scheduler safety net
        logger.exception("Scheduled refresh cycle failed.")
    finally:
        session.close()
