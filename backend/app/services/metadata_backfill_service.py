from __future__ import annotations

import logging
import threading

from app.db.session import get_session_factory
from app.services.metadata_service import refresh_missing_metadata
from app.services.provider_service import get_provider_registry


logger = logging.getLogger(__name__)


_pending_item_ids: set[int] = set()
_pending_lock = threading.Lock()


def queue_missing_metadata_refresh(item_ids: list[int]) -> int:
    provider = get_provider_registry().metadata_provider
    available, message = provider.is_available()
    if not available:
        logger.info("Skipping background metadata refresh queue: %s", message)
        return 0

    unique_ids: list[int] = []
    with _pending_lock:
        for item_id in item_ids:
            if item_id in _pending_item_ids:
                continue
            _pending_item_ids.add(item_id)
            unique_ids.append(item_id)

    if not unique_ids:
        return 0

    thread = threading.Thread(
        target=_background_refresh_worker,
        args=(unique_ids,),
        name="azerothfliplocal-metadata-backfill",
        daemon=True,
    )
    thread.start()
    return len(unique_ids)


def _background_refresh_worker(item_ids: list[int]) -> None:
    session = get_session_factory()()
    try:
        summary = refresh_missing_metadata(session, item_ids)
        logger.info(
            "Background metadata refresh completed for %s queued items; refreshed=%s warnings=%s",
            len(item_ids),
            summary.get("refreshed_count", 0),
            len(summary.get("warnings", [])),
        )
    except Exception:  # pragma: no cover - worker safety
        logger.exception("Background metadata refresh failed.")
    finally:
        session.close()
        with _pending_lock:
            for item_id in item_ids:
                _pending_item_ids.discard(item_id)
