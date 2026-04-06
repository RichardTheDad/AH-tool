from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.scan import ScanLatestResponse, ScanRunRequest, ScanSessionRead
from app.services.scan_service import get_latest_scan, get_scan_session, run_scan


router = APIRouter(tags=["scans"])


@router.post("/scans/run", response_model=ScanSessionRead)
def run_scan_route(payload: ScanRunRequest, db: Session = Depends(get_db)) -> ScanSessionRead:
    return run_scan(db, payload)


@router.get("/scans/latest", response_model=ScanLatestResponse)
def latest_scan(db: Session = Depends(get_db)) -> ScanLatestResponse:
    return ScanLatestResponse(latest=get_latest_scan(db))


@router.get("/scans/{scan_id}", response_model=ScanSessionRead)
def get_scan(scan_id: int, db: Session = Depends(get_db)) -> ScanSessionRead:
    scan = get_scan_session(db, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return scan

