from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

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
from app.services.calibration_service import evaluate_due_predictions, get_calibration_summary
from app.services.scan_runtime_service import get_scan_runtime_state
from app.services.scan_service import ScanAlreadyRunningError, get_latest_scan, get_scan_history, get_scan_readiness, get_scan_session, run_scan


router = APIRouter(tags=["scans"])


@router.post("/scans/run", response_model=ScanSessionRead)
def run_scan_route(payload: ScanRunRequest, db: Session = Depends(get_db)) -> ScanSessionRead:
    try:
        return run_scan(db, payload)
    except ScanAlreadyRunningError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/scans/latest", response_model=ScanLatestResponse)
def latest_scan(
    limit: int | None = Query(default=None, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> ScanLatestResponse:
    return ScanLatestResponse(latest=get_latest_scan(db, limit=limit))


@router.get("/scans/history", response_model=ScanHistoryResponse)
def scan_history(db: Session = Depends(get_db)) -> ScanHistoryResponse:
    return ScanHistoryResponse(scans=get_scan_history(db))


@router.get("/scans/calibration", response_model=ScanCalibrationSummaryRead)
def scan_calibration(db: Session = Depends(get_db)) -> ScanCalibrationSummaryRead:
    evaluate_due_predictions(db, limit=500)
    return get_calibration_summary(db, days=30)


@router.get("/scans/readiness", response_model=ScanReadinessRead)
def scan_readiness(db: Session = Depends(get_db)) -> ScanReadinessRead:
    return get_scan_readiness(db)


@router.get("/scans/status", response_model=ScanRuntimeStatusRead)
def scan_status() -> ScanRuntimeStatusRead:
    return ScanRuntimeStatusRead.model_validate(get_scan_runtime_state().__dict__)


@router.get("/scans/{scan_id}", response_model=ScanSessionRead)
def get_scan(
    scan_id: int,
    limit: int | None = Query(default=None, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> ScanSessionRead:
    scan = get_scan_session(db, scan_id, limit=limit)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return scan
