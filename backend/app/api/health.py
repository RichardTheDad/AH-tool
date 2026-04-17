from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.logging import is_search_crawler
from app.core.config import get_settings
from app.db.session import get_db
from app.jobs.scheduler import manager as scheduler_manager
from app.services.metadata_backfill_service import get_metadata_backfill_status
from app.services.scheduler_audit_service import get_latest_scheduler_event
from app.services.scan_runtime_service import get_scan_runtime_state

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health/live")
def liveness_check() -> dict[str, str]:
    """Fast liveness probe for Fly health checks (no DB dependency)."""
    return {"status": "ok"}


@router.get("/health/ready")
def readiness_check(db: Session = Depends(get_db)) -> dict[str, object]:
    """Readiness probe with lightweight dependency checks."""
    db_status = "ok"
    scheduler_status = "ok"

    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Readiness database check failed")
        db_status = "unavailable"

    runtime_state = get_scan_runtime_state()
    if runtime_state.status == "failed":
        scheduler_status = "degraded"

    # Surface the last scheduler cycle outcome so it can be inspected without auth.
    # Only a safe summary is exposed — no user data or internal details.
    last_cycle_status: str | None = None
    last_cycle_message: str | None = None
    try:
        latest_event = get_latest_scheduler_event(db)
        if latest_event:
            last_cycle_status = latest_event.status
            last_cycle_message = latest_event.message
    except Exception:
        logger.warning("Failed to load latest scheduler event for readiness summary.", exc_info=True)

    overall = "ready" if db_status == "ok" and scheduler_status == "ok" else "degraded"
    return {
        "status": overall,
        "database": db_status,
        "scheduler": scheduler_status,
        "last_cycle_status": last_cycle_status,
        "last_cycle_message": last_cycle_message,
    }


def require_health_diagnostics_access(
    x_health_key: str | None = Header(default=None, alias="X-Health-Key"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> None:
    settings = get_settings()
    if not settings.restrict_health_diagnostics:
        return

    configured_key = settings.health_diagnostics_api_key.strip()
    if configured_key and x_health_key and x_health_key == configured_key:
        return

    if authorization:
        get_current_user(authorization=authorization)
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Detailed health diagnostics require authentication.",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.get("/health")
def health_check(
    db: Session = Depends(get_db),
    request: Request = None,
) -> dict[str, object]:
    # Log crawler access for SEO monitoring (Phase 6)
    if request and is_search_crawler(request.headers.get("user-agent")):
        logger.info(
            f"Crawler health check: {request.headers.get('user-agent')} from {request.client.host if request.client else 'unknown'}"
        )

    db_status = "ok"
    try:
        # Bound DB readiness checks so this endpoint fails fast under pool pressure.
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Health check database query failed")
        db_status = "unavailable"

    return {
        "status": "ok",
        "database": db_status,
    }


@router.get("/health/scheduler")
def scheduler_health(
    db: Session = Depends(get_db),
    _auth: None = Depends(require_health_diagnostics_access),
) -> dict[str, object]:
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
def metadata_health(_auth: None = Depends(require_health_diagnostics_access)) -> dict[str, object]:
    return {
        "metadata_backfill": get_metadata_backfill_status(),
    }


@router.get("/health/database-pool")
def database_pool_health(_auth: None = Depends(require_health_diagnostics_access)) -> dict[str, object]:
    """Diagnostics endpoint for database connection pool status."""
    from app.db.session import get_engine
    
    engine = get_engine()
    pool = engine.pool
    
    # Get pool stats if available
    pool_status = {
        "pool_type": pool.__class__.__name__,
        "size": None,
        "overflow": None,
        "checked_out": None,
        "checked_in": None,
    }
    
    # SQLAlchemy connection pool stats (available on most pool types)
    if hasattr(pool, "size"):
        pool_status["size"] = pool.size()
    if hasattr(pool, "overflow"):
        pool_status["overflow"] = pool.overflow()
    if hasattr(pool, "checkedout"):
        pool_status["checked_out"] = pool.checkedout()
    
    return {
        "database_pool": pool_status,
    }

