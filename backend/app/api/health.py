from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.jobs.scheduler import manager as scheduler_manager


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
        "scheduler": scheduler_manager.status(),
    }

