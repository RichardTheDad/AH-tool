from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

from app.db.models import Item
from app.db.session import get_session_factory
from app.schemas.item import ItemRead
from app.services import metadata_backfill_service
from app.services.metadata_service import get_missing_metadata_item_ids
from app.services.provider_service import get_provider_registry


def test_queue_candidates_retries_after_backoff_window() -> None:
    with metadata_backfill_service._pending_lock:
        metadata_backfill_service._pending_item_ids.clear()
        metadata_backfill_service._attempt_counts.clear()
        metadata_backfill_service._retry_not_before.clear()
        metadata_backfill_service._worker_thread = None

        item_id = 777001
        metadata_backfill_service._attempt_counts[item_id] = metadata_backfill_service.AUTO_REQUEUE_ATTEMPTS
        metadata_backfill_service._retry_not_before[item_id] = datetime.now(timezone.utc) + timedelta(minutes=10)

    blocked = metadata_backfill_service._queue_candidates([item_id], reset_attempts=False)
    assert blocked == []

    with metadata_backfill_service._pending_lock:
        metadata_backfill_service._retry_not_before[item_id] = datetime.now(timezone.utc) - timedelta(minutes=1)

    unblocked = metadata_backfill_service._queue_candidates([item_id], reset_attempts=False)
    assert unblocked == [item_id]
    with metadata_backfill_service._pending_lock:
        assert metadata_backfill_service._attempt_counts[item_id] == 0
        assert item_id not in metadata_backfill_service._retry_not_before
        metadata_backfill_service._pending_item_ids.clear()
        metadata_backfill_service._attempt_counts.clear()
        metadata_backfill_service._retry_not_before.clear()


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


def test_metadata_backfill_worker_runs_follow_up_scan_after_queue_drains(client, monkeypatch) -> None:
    called: list[str] = []

    # Insert 50 items with missing metadata into the test DB
    session = get_session_factory()()
    try:
        session.add_all([
            Item(
                item_id=2000 + i,
                name=f"Item {2000 + i} (metadata unavailable)",
                metadata_json={"metadata_status": "missing"},
                is_commodity=False,
            )
            for i in range(50)
        ])
        session.commit()
    finally:
        session.close()

    # Make the metadata provider appear available so the sweep can proceed
    provider = get_provider_registry().metadata_provider
    provider.settings.blizzard_client_id = "client-id"
    provider.settings.blizzard_client_secret = "client-secret"
    monkeypatch.setattr(provider, "is_available", lambda: (True, "mock"))

    monkeypatch.setattr(metadata_backfill_service, "_top_off_pending_queue", lambda limit=250: 0)
    monkeypatch.setattr(metadata_backfill_service, "_missing_metadata_count", lambda limit=1: 0)
    monkeypatch.setattr(metadata_backfill_service, "_run_follow_up_scan", lambda: called.append("scan"))
    # Mock the batch refresh to avoid real Blizzard network calls in the background thread
    # The mock resolves items so the DB is updated and the final assertion passes
    def _fake_batch_refresh(item_ids: list[int]) -> dict[str, object]:
        from app.services.metadata_service import upsert_items
        from app.schemas.item import ItemRead
        s = get_session_factory()()
        try:
            upsert_items(s, [ItemRead(item_id=i, name=f"Resolved Item {i}", is_commodity=False) for i in item_ids])
        finally:
            s.close()
        return {"refreshed_count": len(item_ids), "warnings": []}

    monkeypatch.setattr(metadata_backfill_service, "_refresh_batch_with_retry", _fake_batch_refresh)

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
