from __future__ import annotations

import time

from app.db.models import Item
from app.db.session import get_session_factory
from app.schemas.item import ItemRead
from app.services import metadata_backfill_service
from app.services.metadata_service import get_missing_metadata_item_ids
from app.services.provider_service import get_provider_registry


def test_metadata_backfill_worker_auto_tops_off_until_all_missing_items_are_resolved(client, monkeypatch) -> None:
    provider = get_provider_registry().metadata_provider
    monkeypatch.setattr(provider, "is_available", lambda: (True, "Configured for live Blizzard item metadata lookups."))
    monkeypatch.setattr(
        provider,
        "fetch_item",
        lambda item_id: ItemRead(item_id=item_id, name=f"Resolved Item {item_id}", is_commodity=False),
    )

    with metadata_backfill_service._pending_lock:
        metadata_backfill_service._pending_item_ids.clear()
        metadata_backfill_service._attempt_counts.clear()
        metadata_backfill_service._worker_thread = None

    session = get_session_factory()()
    try:
        session.add_all(
            [
                Item(
                    item_id=item_id,
                    name=f"Item {item_id} (metadata unavailable)",
                    metadata_json={"metadata_status": "missing"},
                    is_commodity=False,
                )
                for item_id in range(1000, 1060)
            ]
        )
        session.commit()
    finally:
        session.close()


def test_metadata_backfill_worker_runs_follow_up_scan_after_queue_drains(monkeypatch) -> None:
    called: list[str] = []

    monkeypatch.setattr(metadata_backfill_service, "_top_off_pending_queue", lambda limit=250: 0)
    monkeypatch.setattr(metadata_backfill_service, "_missing_metadata_count", lambda limit=1: 0)
    monkeypatch.setattr(metadata_backfill_service, "_run_follow_up_scan", lambda: called.append("scan"))

    with metadata_backfill_service._pending_lock:
        metadata_backfill_service._pending_item_ids.clear()
        metadata_backfill_service._attempt_counts.clear()
        metadata_backfill_service._worker_thread = object()  # type: ignore[assignment]
    metadata_backfill_service._run_follow_up_scan_when_resolved = True

    metadata_backfill_service._background_refresh_worker()

    assert called == ["scan"]
    assert metadata_backfill_service._run_follow_up_scan_when_resolved is False
    assert metadata_backfill_service._worker_thread is None

    queued = metadata_backfill_service.queue_missing_metadata_sweep(limit=50)
    assert queued == 50

    deadline = time.time() + 5
    while time.time() < deadline:
        worker = metadata_backfill_service._worker_thread
        if worker is None or not worker.is_alive():
            break
        time.sleep(0.05)

    session = get_session_factory()()
    try:
        assert get_missing_metadata_item_ids(session, limit=100) == []
    finally:
        session.close()
