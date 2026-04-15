from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import OperationalError

from app.core.config import get_settings
from app.db.models import Item
from app.db.session import get_session_factory
from app.services.metadata_service import get_missing_metadata_item_ids, item_has_missing_metadata, refresh_missing_metadata
from app.services.provider_service import get_provider_registry


logger = logging.getLogger(__name__)


_pending_item_ids: set[int] = set()
_pending_lock = threading.Lock()
_worker_thread: threading.Thread | None = None
_attempt_counts: dict[int, int] = {}
_retry_not_before: dict[int, datetime] = {}
_run_follow_up_scan_when_resolved = False

METADATA_BATCH_SIZE = 50
LOCK_RETRY_ATTEMPTS = 4
LOCK_RETRY_DELAY_SECONDS = 1.5
AUTO_REQUEUE_ATTEMPTS = 5
AUTO_TOP_OFF_LIMIT = 250
AUTO_REQUEUE_BACKOFF_MINUTES = 45


def _get_still_missing_item_ids(item_ids: list[int]) -> list[int]:
    session = get_session_factory()()
    try:
        items = session.query(Item).filter(Item.item_id.in_(item_ids)).all()
        items_by_id = {item.item_id: item for item in items}
        return [
            item_id
            for item_id in item_ids
            if item_id in items_by_id and item_has_missing_metadata(items_by_id[item_id])
        ]
    finally:
        session.close()


def _load_more_missing_item_ids(*, limit: int = AUTO_TOP_OFF_LIMIT) -> list[int]:
    session = get_session_factory()()
    try:
        return get_missing_metadata_item_ids(session, limit=limit)
    finally:
        session.close()


def _queue_candidates(candidate_item_ids: list[int], *, reset_attempts: bool) -> list[int]:
    queued_item_ids: list[int] = []
    now = datetime.now(timezone.utc)
    with _pending_lock:
        for item_id in candidate_item_ids:
            if reset_attempts:
                _attempt_counts[item_id] = 0
                _retry_not_before.pop(item_id, None)
            else:
                retry_not_before = _retry_not_before.get(item_id)
                if retry_not_before is not None:
                    if retry_not_before > now:
                        continue
                    _retry_not_before.pop(item_id, None)
                    _attempt_counts[item_id] = 0
                elif _attempt_counts.get(item_id, 0) >= AUTO_REQUEUE_ATTEMPTS:
                    _retry_not_before[item_id] = now + timedelta(minutes=AUTO_REQUEUE_BACKOFF_MINUTES)
                    continue
            if item_id in _pending_item_ids:
                continue
            _pending_item_ids.add(item_id)
            queued_item_ids.append(item_id)
    return queued_item_ids


def get_metadata_backfill_status() -> dict[str, object]:
    now = datetime.now(timezone.utc)
    with _pending_lock:
        earliest_retry = min(_retry_not_before.values()) if _retry_not_before else None
        backoff_items = sum(1 for value in _retry_not_before.values() if value > now)
        return {
            "worker_running": bool(_worker_thread and _worker_thread.is_alive()),
            "pending_count": len(_pending_item_ids),
            "attempt_tracked_count": len(_attempt_counts),
            "backoff_count": backoff_items,
            "next_retry_at": earliest_retry.isoformat() if earliest_retry else None,
            "follow_up_scan_when_resolved": _run_follow_up_scan_when_resolved,
        }


def _missing_metadata_count(*, limit: int = 1) -> int:
    session = get_session_factory()()
    try:
        return len(get_missing_metadata_item_ids(session, limit=limit))
    finally:
        session.close()


def _run_follow_up_scan() -> None:
    from app.schemas.scan import ScanRunRequest
    from app.services.realm_service import get_enabled_realm_names

    session = get_session_factory()()
    try:
        from app.db.models import AppSettings
        # Best-effort: use the first active user's context for the background scan
        app_settings_row = session.query(AppSettings).first()
        if app_settings_row is None:
            logger.info("Skipping follow-up scan after metadata resolution: no user settings found.")
            return
        realms = get_enabled_realm_names(session, app_settings_row.user_id)
        if not realms:
            logger.info("Skipping follow-up scan after metadata resolution: no enabled realms.")
            return

        provider = get_provider_registry().get_listing_provider(None)
        if not provider.supports_live_fetch:
            logger.info("Skipping follow-up scan after metadata resolution: live provider not available.")
            return

        from app.services.scan_service import run_user_scan
        run_user_scan(
            session,
            app_settings_row.user_id,
            ScanRunRequest(refresh_live=provider.supports_live_fetch, include_losers=False),
        )
        logger.info("Triggered follow-up scan after metadata queue fully resolved.")
    except Exception:  # pragma: no cover - worker safety
        logger.exception("Follow-up scan after metadata resolution failed.")
    finally:
        session.close()


def queue_missing_metadata_refresh(item_ids: list[int]) -> int:
    global _run_follow_up_scan_when_resolved
    provider = get_provider_registry().metadata_provider
    available, message = provider.is_available()
    if not available:
        logger.info("Skipping background metadata refresh queue: %s", message)
        return 0

    unique_ids = _queue_candidates(item_ids, reset_attempts=True)
    if not unique_ids:
        return 0

    _run_follow_up_scan_when_resolved = True
    _ensure_worker_running()
    return len(unique_ids)


def _ensure_worker_running() -> None:
    global _worker_thread
    with _pending_lock:
        if _worker_thread is not None and _worker_thread.is_alive():
            return
        _worker_thread = threading.Thread(
            target=_background_refresh_worker,
            name="azerothfliplocal-metadata-backfill",
            daemon=True,
        )
        _worker_thread.start()


def _refresh_batch_with_retry(item_ids: list[int]) -> dict[str, object]:
    attempt = 0
    while True:
        attempt += 1
        session = get_session_factory()()
        try:
            return refresh_missing_metadata(session, item_ids)
        except OperationalError as exc:
            session.rollback()
            message = str(exc).lower()
            if "database is locked" in message and attempt < LOCK_RETRY_ATTEMPTS:
                delay = LOCK_RETRY_DELAY_SECONDS * attempt
                logger.info(
                    "Metadata batch hit a database lock for %s items; retrying in %.1fs (attempt %s/%s).",
                    len(item_ids),
                    delay,
                    attempt,
                    LOCK_RETRY_ATTEMPTS,
                )
                time.sleep(delay)
                continue
            raise
        finally:
            session.close()


def _background_refresh_worker() -> None:
    global _run_follow_up_scan_when_resolved, _worker_thread
    should_run_follow_up_scan = False
    while True:
        _top_off_pending_queue(limit=AUTO_TOP_OFF_LIMIT)
        with _pending_lock:
            if not _pending_item_ids:
                should_run_follow_up_scan = _run_follow_up_scan_when_resolved
                _run_follow_up_scan_when_resolved = False
                _worker_thread = None
                break
            item_ids = sorted(_pending_item_ids)[:METADATA_BATCH_SIZE]

        try:
            summary = _refresh_batch_with_retry(item_ids)
            logger.info(
                "Background metadata refresh completed for %s queued items; refreshed=%s warnings=%s",
                len(item_ids),
                summary.get("refreshed_count", 0),
                len(summary.get("warnings", [])),
            )
        except Exception:  # pragma: no cover - worker safety
            logger.exception("Background metadata refresh failed for a batch of %s items.", len(item_ids))
        finally:
            still_missing_item_ids = _get_still_missing_item_ids(item_ids)
            with _pending_lock:
                for item_id in item_ids:
                    _pending_item_ids.discard(item_id)
                    if item_id not in still_missing_item_ids:
                        _attempt_counts.pop(item_id, None)
                        _retry_not_before.pop(item_id, None)
                        continue

                    next_attempt = _attempt_counts.get(item_id, 0) + 1
                    _attempt_counts[item_id] = next_attempt
                    if next_attempt < AUTO_REQUEUE_ATTEMPTS:
                        _pending_item_ids.add(item_id)
                    else:
                        retry_at = datetime.now(timezone.utc) + timedelta(minutes=AUTO_REQUEUE_BACKOFF_MINUTES)
                        _retry_not_before[item_id] = retry_at
                        logger.warning(
                            "Pausing automatic metadata retries for item %s after %s attempts; next retry after %s.",
                            item_id,
                            next_attempt,
                            retry_at.isoformat(),
                        )

    if should_run_follow_up_scan and _missing_metadata_count(limit=1) == 0:
        _run_follow_up_scan()


def queue_missing_metadata_sweep(*, limit: int = 250) -> int:
    global _run_follow_up_scan_when_resolved
    provider = get_provider_registry().metadata_provider
    available, message = provider.is_available()
    if not available:
        logger.info("Skipping metadata sweep queue: %s", message)
        return 0

    candidate_item_ids = _load_more_missing_item_ids(limit=limit)
    unique_ids = _queue_candidates(candidate_item_ids, reset_attempts=True)
    if not unique_ids:
        return 0

    _run_follow_up_scan_when_resolved = True
    _ensure_worker_running()
    return len(unique_ids)


def _top_off_pending_queue(*, limit: int = AUTO_TOP_OFF_LIMIT) -> int:
    candidate_item_ids = _load_more_missing_item_ids(limit=limit)
    return len(_queue_candidates(candidate_item_ids, reset_attempts=False))
