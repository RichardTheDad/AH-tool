from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import SYSTEM_USER_ID
from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.scan import (
    ScanCalibrationSummaryRead,
    ScanHistoryResponse,
    ScanLatestResponse,
    ScanReadinessRead,
    ScanRunRequest,
    ScanRuntimeStatusRead,
    ScanSessionRead,
)
from app.services.realm_service import get_all_enabled_realm_names
from app.services.calibration_service import get_calibration_summary
from app.jobs.scheduler import manager as scheduler_manager
from app.services.scan_runtime_service import get_scan_runtime_state
from app.services.scan_service import get_latest_scan, get_scan_history, get_scan_readiness, get_scan_session


router = APIRouter(tags=["scans"])


@router.post("/scans/run", response_model=ScanSessionRead)
@limiter.limit("1/minute")
def run_scan_route(request: Request, payload: ScanRunRequest, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> ScanSessionRead:
    del request
    del payload
    del db
    del current_user
    raise HTTPException(
        status_code=403,
        detail="Manual scan runs are disabled. Scans are scheduler-driven and update automatically.",
    )


@router.get("/scans/latest", response_model=ScanLatestResponse)
def latest_scan(
    limit: int | None = Query(default=None, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
) -> ScanLatestResponse:
    del current_user
    return ScanLatestResponse(latest=get_latest_scan(db, SYSTEM_USER_ID, limit=limit))


@router.get("/scans/history", response_model=ScanHistoryResponse)
def scan_history(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> ScanHistoryResponse:
    del current_user
    return ScanHistoryResponse(scans=get_scan_history(db, SYSTEM_USER_ID))


@router.get("/scans/calibration", response_model=ScanCalibrationSummaryRead)
def scan_calibration(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> ScanCalibrationSummaryRead:
    del current_user
    return get_calibration_summary(db, SYSTEM_USER_ID, days=30)


@router.get("/scans/readiness", response_model=ScanReadinessRead)
def scan_readiness(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> ScanReadinessRead:
    del current_user
    realms = get_all_enabled_realm_names(db)
    return get_scan_readiness(db, SYSTEM_USER_ID, realms=realms)


@router.get("/scans/status", response_model=ScanRuntimeStatusRead)
def scan_status(current_user: str = Depends(get_current_user)) -> ScanRuntimeStatusRead:
    del current_user
    runtime_state = get_scan_runtime_state().__dict__
    scheduler_status = scheduler_manager.status()
    refresh_cycle = scheduler_status.get("refresh_cycle") if isinstance(scheduler_status, dict) else None
    next_scheduled_at = refresh_cycle.get("next_run_time") if isinstance(refresh_cycle, dict) else None
    payload = {
        **runtime_state,
        "next_scheduled_at": next_scheduled_at,
    }
    return ScanRuntimeStatusRead.model_validate(payload)


@router.get("/scans/{scan_id}", response_model=ScanSessionRead)
def get_scan(
    scan_id: int,
    limit: int | None = Query(default=None, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
) -> ScanSessionRead:
    del current_user
    scan = get_scan_session(db, scan_id, SYSTEM_USER_ID, limit=limit)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return scan
