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
from app.services.scan_runtime_service import mark_scan_failed, mark_scan_finished, mark_scan_started
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


def _run_system_scan(realms: list[str]) -> None:
    """Run a single global scored-opportunities scan after a data refresh.

    Opens its own DB session so it does not inherit the bloated identity map
    from the listing-snapshot data-refresh step.
    """
    from app.schemas.scan import ScanRunRequest
    from app.services.scan_service import ScanAlreadyRunningError, run_user_scan

    scan_session = get_session_factory()()
    try:
        result = run_user_scan(
            scan_session,
            SYSTEM_USER_ID,
            ScanRunRequest(
                refresh_live=False,
                include_losers=False,
                buy_realms=None,
                sell_realms=None,
            ),
            realms=realms,
        )
        logger.info("Scheduled global scan completed with %d result(s).", result.result_count)
    except ScanAlreadyRunningError as exc:
        logger.info("Skipping scheduled global scan: scan already running.")
        raise RuntimeError("Scheduled global scan skipped because another scan is already running.") from exc
    except Exception as exc:
        logger.exception("Scheduled global scan failed.")
        try:
            scan_session.rollback()
        except Exception:
            logger.debug("Rollback failed after scheduled global scan exception.", exc_info=True)
        raise RuntimeError(f"Scheduled global scan failed: {type(exc).__name__}: {exc}") from exc
    finally:
        scan_session.close()


def _select_system_scan_realms(realms: list[str]) -> list[str]:
    max_realms = max(2, int(get_settings().scheduler_system_scan_max_realms or 2))
    if len(realms) <= max_realms:
        return realms
    selected = sorted(realms, key=str.casefold)[:max_realms]
    logger.warning(
        "Capping scheduled system scan realm scope from %d to %d realms to keep automatic scans reliable.",
        len(realms),
        len(selected),
    )
    return selected


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
    current_stage = "init"

    def _finish(status: str, message: str, *, details: dict[str, object] | None = None) -> None:
        record_scheduler_event(
            status=status,
            message=message,
            started_at=datetime.fromtimestamp(cycle_started_at, tz=timezone.utc),
            finished_at=datetime.now(timezone.utc),
            details=details,
        )

    def _stage(stage: str, message: str, *, details: dict[str, object] | None = None) -> None:
        record_scheduler_event(
            status=f"running.{stage}",
            message=message,
            started_at=datetime.fromtimestamp(cycle_started_at, tz=timezone.utc),
            finished_at=None,
            details={"provider": provider_name, **(details or {})},
        )

    try:
        current_stage = "purge"
        _stage(current_stage, "Purging expired app data.")
        purge_expired_app_data(session)

        current_stage = "mark_stale"
        _stage(current_stage, "Marking stale listing snapshots.")
        mark_stale_snapshots(session, max_updates_per_run=2_000)

        current_stage = "load_realms"
        _stage(current_stage, "Loading enabled realms.")
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

        # Cross-machine concurrency is already controlled by the PostgreSQL advisory
        # lock in scheduler.py. Marking started unconditionally here avoids a stale
        # per-process runtime flag from suppressing refresh cycles on a single VM.
        current_stage = "mark_runtime_started"
        _stage(current_stage, "Marking runtime scan state started.", details={"realm_count": len(realms)})
        mark_scan_started(provider_name)

        system_scan_realms = _select_system_scan_realms(realms)
        current_stage = "system_scan"
        _stage(
            current_stage,
            "Running scheduled system scan.",
            details={
                "realm_count": len(realms),
                "system_scan_realm_count": len(system_scan_realms),
            },
        )
        _run_system_scan(system_scan_realms)

        inserted = 0
        warning = None
        try:
            current_stage = "provider_refresh"
            _stage(current_stage, "Refreshing listing data from provider.", details={"realm_count": len(realms)})
            inserted, warning = refresh_from_provider(session, realms, provider_name)
            if warning:
                logger.info("Data refresh warning: %s", warning)
            else:
                logger.info("Refreshed listing data for %d realm(s) (%d rows written).", len(realms), inserted)
        except Exception as exc:
            warning = f"Provider refresh failed; continuing with cached data. {type(exc).__name__}: {exc}"
            logger.exception("Scheduled provider refresh failed; continuing with cached listing data.")
        finally:
            mark_scan_finished(provider_name, result_count=inserted, warning_text=warning)

        current_stage = "metadata_sweep"
        _stage(current_stage, "Queueing metadata sweep.")
        queued = queue_missing_metadata_sweep(limit=200)
        if queued:
            logger.info("Queued metadata sweep for %d unresolved item(s).", queued)

        current_stage = "calibration"
        _stage(current_stage, "Evaluating calibration telemetry.")
        evaluated = _run_with_sqlite_lock_retry(
            session,
            "Calibration telemetry evaluation",
            lambda: evaluate_due_predictions(session, limit=500),
        )
        if evaluated:
            logger.info("Updated %d calibration telemetry event(s).", evaluated)

        current_stage = "realm_suggestions"
        _stage(current_stage, "Refreshing weekly realm suggestions.")
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
                "system_scan_realm_count": len(system_scan_realms),
                "inserted": inserted,
                "metadata_queued": queued,
                "calibration_evaluated": evaluated,
                "realm_suggestions_due": suggestion_queued,
                "realm_suggestions_refreshed": suggestion_completed,
            },
        )
    except Exception as exc:  # pragma: no cover - scheduler safety net
        _finish(
            "failed.exception",
            f"Scheduled refresh cycle failed during stage '{current_stage}': {type(exc).__name__}: {exc}",
            details={
                "provider": provider_name,
                "stage": current_stage,
                "error_type": type(exc).__name__,
                "error": str(exc),
            },
        )
        logger.exception("Scheduled refresh cycle failed.")
    finally:
        session.close()
