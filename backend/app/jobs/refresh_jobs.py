from __future__ import annotations

from datetime import datetime, timezone
import logging
import time

from sqlalchemy.exc import OperationalError

from app.core.config import SYSTEM_USER_ID, get_settings
from app.db.init_db import purge_expired_app_data
from app.db.models import TrackedRealm
from app.db.session import get_session_factory
from app.services.metadata_backfill_service import queue_missing_metadata_sweep
from app.services.listing_service import mark_stale_snapshots, refresh_from_provider
from app.services.provider_service import get_provider_registry
from app.services.calibration_service import evaluate_due_predictions
from app.services.realm_service import get_all_enabled_realm_names
from app.services.scheduler_audit_service import record_scheduler_event
from app.services.scan_runtime_service import mark_scan_failed, mark_scan_finished, try_mark_scan_started
from app.services.realm_suggestion_service import run_realm_suggestions, should_refresh_realm_suggestions


logger = logging.getLogger(__name__)


LOCK_RETRY_ATTEMPTS = 4
LOCK_RETRY_DELAY_SECONDS = 1.5
REALM_SUGGESTION_WEEKLY_COOLDOWN_MINUTES = 7 * 24 * 60


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


def _run_system_scan(session, realms: list[str]) -> None:
    """Run a single global scored-opportunities scan after a data refresh."""
    from app.schemas.scan import ScanRunRequest
    from app.services.scan_service import ScanAlreadyRunningError, run_user_scan

    try:
        result = run_user_scan(
            session,
            SYSTEM_USER_ID,
            ScanRunRequest(refresh_live=False, include_losers=False),
            realms=realms,
        )
        logger.info("Scheduled global scan completed with %d result(s).", result.result_count)
    except ScanAlreadyRunningError:
        logger.info("Skipping scheduled global scan: scan already running.")
    except Exception:
        logger.exception("Scheduled global scan failed.")


def _run_weekly_realm_suggestions(session) -> tuple[int, int]:
    """Refresh suggested source realms for users due for a weekly update.

    This runs only after the main scheduled scan has completed so the suggestions
    use the newest snapshot baseline.
    """
    user_ids = [
        user_id
        for (user_id,) in (
            session.query(TrackedRealm.user_id)
            .filter(TrackedRealm.enabled.is_(True))
            .distinct()
            .all()
        )
        if user_id
    ]
    if not user_ids:
        return 0, 0

    queued = 0
    completed = 0
    for user_id in user_ids:
        due, _latest = should_refresh_realm_suggestions(
            session,
            user_id=user_id,
            cooldown_minutes=REALM_SUGGESTION_WEEKLY_COOLDOWN_MINUTES,
        )
        if not due:
            continue
        queued += 1
        try:
            run_realm_suggestions(session, user_id)
            completed += 1
        except Exception:
            logger.exception("Weekly realm suggestion refresh failed for user %s.", user_id)

    return queued, completed


def run_refresh_cycle() -> None:
    """Background data-refresh cycle.

    Fetches raw listing data for the union of all users' enabled realms and stores
    it in the shared ListingSnapshot table. Individual user scans are computed on
    demand via the API using each user's personal settings and realm list.
    """
    session = get_session_factory()()
    provider_name = get_settings().default_listing_provider
    cycle_started_at = time.time()

    def _finish(status: str, message: str, *, details: dict[str, object] | None = None) -> None:
        record_scheduler_event(
            status=status,
            message=message,
            started_at=datetime.fromtimestamp(cycle_started_at, tz=timezone.utc),
            finished_at=datetime.now(timezone.utc),
            details=details,
        )

    try:
        purge_expired_app_data(session)
        mark_stale_snapshots(session)

        realms = get_all_enabled_realm_names(session)
        if not realms:
            skip_message = "Skipping scheduled data refresh: no enabled realms across all users."
            logger.info(skip_message)
            _finish("skipped.no_realms", skip_message, details={"realm_count": 0})
            return

        provider = get_provider_registry().get_listing_provider(None)
        if not provider.supports_live_fetch:
            skip_message = f"Skipping scheduled data refresh: provider '{provider_name}' does not support live fetch."
            logger.info(skip_message)
            _finish("skipped.provider_no_live_fetch", skip_message, details={"provider": provider_name, "realm_count": len(realms)})
            return

        if not try_mark_scan_started(provider_name):
            skip_message = "Skipping scheduled data refresh: a refresh is already running."
            logger.info(skip_message)
            _finish("skipped.already_running", skip_message, details={"provider": provider_name, "realm_count": len(realms)})
            return

        inserted = 0
        warning = None
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

        _run_system_scan(session, realms)
        suggestion_queued, suggestion_completed = _run_weekly_realm_suggestions(session)
        if suggestion_completed:
            logger.info(
                "Weekly realm suggestions refreshed for %d/%d due user(s).",
                suggestion_completed,
                suggestion_queued,
            )
        status = "success.warning" if warning else "success"
        message = warning or "Scheduled refresh cycle completed successfully."
        _finish(
            status,
            message,
            details={
                "provider": provider_name,
                "realm_count": len(realms),
                "inserted": inserted,
                "metadata_queued": queued,
                "calibration_evaluated": evaluated,
                "realm_suggestions_due": suggestion_queued,
                "realm_suggestions_refreshed": suggestion_completed,
            },
        )
    except Exception:  # pragma: no cover - scheduler safety net
        _finish(
            "failed.exception",
            "Scheduled refresh cycle failed unexpectedly.",
            details={"provider": provider_name},
        )
        logger.exception("Scheduled refresh cycle failed.")
    finally:
        session.close()
