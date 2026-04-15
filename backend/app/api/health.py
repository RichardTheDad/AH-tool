from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.jobs.scheduler import manager as scheduler_manager
from app.services.metadata_backfill_service import get_metadata_backfill_status
from app.services.scheduler_audit_service import get_latest_scheduler_event
from app.services.scan_runtime_service import get_scan_runtime_state


router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "unavailable"
    return {
        "status": "ok",
        "database": db_status,
    }


@router.get("/health/scheduler")
def scheduler_health(db: Session = Depends(get_db)) -> dict[str, object]:
    runtime_state = get_scan_runtime_state()
    latest_event = get_latest_scheduler_event(db)
    return {
        "scheduler": scheduler_manager.status(),
        "last_persisted_cycle": (
            {
                "status": latest_event.status,
                "message": latest_event.message,
                "applied_at": latest_event.applied_at.isoformat(),
                "started_at": latest_event.started_at.isoformat() if latest_event.started_at else None,
                "finished_at": latest_event.finished_at.isoformat() if latest_event.finished_at else None,
                "details": latest_event.details,
            }
            if latest_event
            else None
        ),
        "scan_runtime": {
            "status": runtime_state.status,
            "message": runtime_state.message,
            "provider_name": runtime_state.provider_name,
            "started_at": runtime_state.started_at.isoformat() if runtime_state.started_at else None,
            "finished_at": runtime_state.finished_at.isoformat() if runtime_state.finished_at else None,
        },
        "configured": {
            "enable_scheduler": get_settings().enable_scheduler,
            "scheduler_refresh_interval_minutes": get_settings().scheduler_refresh_interval_minutes,
        },
    }


@router.get("/health/metadata")
def metadata_health() -> dict[str, object]:
    return {
        "metadata_backfill": get_metadata_backfill_status(),
    }

