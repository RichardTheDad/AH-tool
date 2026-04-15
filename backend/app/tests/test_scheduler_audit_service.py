from __future__ import annotations

from datetime import datetime, timezone

from app.db.session import get_session_factory
from app.services.scheduler_audit_service import get_latest_scheduler_event, record_scheduler_event


def test_scheduler_event_is_persisted_and_readable(client) -> None:
    del client
    now = datetime.now(timezone.utc)
    record_scheduler_event(
        status="skipped.no_realms",
        message="Skipping scheduled data refresh: no enabled realms across all users.",
        started_at=now,
        finished_at=now,
        details={"realm_count": 0},
    )

    session = get_session_factory()()
    try:
        latest = get_latest_scheduler_event(session)
        assert latest is not None
        assert latest.status == "skipped.no_realms"
        assert "no enabled realms" in latest.message.lower()
        assert latest.details.get("realm_count") == 0
    finally:
        session.close()
