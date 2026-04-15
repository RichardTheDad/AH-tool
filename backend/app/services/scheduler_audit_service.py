from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import SYSTEM_USER_ID
from app.db.models import TuningActionAudit
from app.db.session import get_session_factory


SCHEDULER_AUDIT_SOURCE = "scheduler_refresh_cycle"
SCHEDULER_AUDIT_LABEL = "Scheduled refresh cycle"


@dataclass
class SchedulerAuditEntry:
    status: str
    message: str
    applied_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    details: dict[str, Any]


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def record_scheduler_event(
    *,
    status: str,
    message: str,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Persist the latest scheduler cycle state in the DB for restart-safe diagnostics."""
    session = get_session_factory()()
    try:
        started = _as_utc(started_at)
        finished = _as_utc(finished_at) or datetime.now(timezone.utc)
        payload = {
            "status": status,
            "message": message,
            "started_at": started.isoformat() if started else None,
            "finished_at": finished.isoformat() if finished else None,
            "details": details or {},
        }
        session.add(
            TuningActionAudit(
                user_id=SYSTEM_USER_ID,
                action_id=f"scheduler.{status}",
                action_label=SCHEDULER_AUDIT_LABEL,
                source=SCHEDULER_AUDIT_SOURCE,
                applied_at=finished,
                blocked=status.startswith("failed") or status.startswith("skipped"),
                blocked_reason=message,
                previous_settings_json=None,
                resulting_settings_json=payload,
            )
        )
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


def get_latest_scheduler_event(session: Session) -> SchedulerAuditEntry | None:
    row = (
        session.query(TuningActionAudit)
        .filter(
            TuningActionAudit.user_id == SYSTEM_USER_ID,
            TuningActionAudit.source == SCHEDULER_AUDIT_SOURCE,
        )
        .order_by(TuningActionAudit.applied_at.desc())
        .first()
    )
    if row is None:
        return None

    payload = row.resulting_settings_json if isinstance(row.resulting_settings_json, dict) else {}
    details = payload.get("details") if isinstance(payload.get("details"), dict) else {}
    started_raw = payload.get("started_at")
    finished_raw = payload.get("finished_at")
    started_at = None
    finished_at = None
    if isinstance(started_raw, str):
        try:
            started_at = datetime.fromisoformat(started_raw)
        except ValueError:
            started_at = None
    if isinstance(finished_raw, str):
        try:
            finished_at = datetime.fromisoformat(finished_raw)
        except ValueError:
            finished_at = None

    status_value = payload.get("status") if isinstance(payload.get("status"), str) else row.action_id.removeprefix("scheduler.")
    message_value = payload.get("message") if isinstance(payload.get("message"), str) else (row.blocked_reason or "")
    return SchedulerAuditEntry(
        status=status_value,
        message=message_value,
        applied_at=_as_utc(row.applied_at) or datetime.now(timezone.utc),
        started_at=_as_utc(started_at),
        finished_at=_as_utc(finished_at),
        details=details,
    )
