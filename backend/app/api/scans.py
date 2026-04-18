import logging
from threading import Lock
from time import monotonic
from typing import Callable, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_optional_user
from app.core.config import SYSTEM_USER_ID, get_settings
from app.db.models import ScanResult, ScanSession
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
from app.services.realm_service import get_enabled_realm_names
from app.services.calibration_service import get_calibration_summary
from app.jobs.scheduler import manager as scheduler_manager
from app.services.scan_runtime_service import get_scan_runtime_state
from app.services.scan_service import get_latest_scan, get_scan_history, get_scan_readiness, get_scan_session


router = APIRouter(tags=["scans"])
logger = logging.getLogger(__name__)

_T = TypeVar("_T")
_CACHE_LOCK = Lock()
_CACHE: dict[str, tuple[float, object]] = {}
_CACHE_ENABLED = not get_settings().database_url.startswith("sqlite")


def _read_through_cache(key: str, ttl_seconds: float, loader: Callable[[], _T]) -> _T:
    if not _CACHE_ENABLED:
        return loader()

    now = monotonic()
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and now - cached[0] <= ttl_seconds:
            return cached[1]  # type: ignore[return-value]
    value = loader()
    with _CACHE_LOCK:
        _CACHE[key] = (now, value)
    return value


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
@limiter.limit("30/minute")
def latest_scan(
    request: Request,
    limit: int | None = Query(default=50, ge=1, le=2000),
    buy_realm: list[str] | None = Query(default=None),
    sell_realm: list[str] | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: str | None = Depends(get_optional_user),
) -> ScanLatestResponse:
    del request
    del current_user
    has_realm_filter = bool(buy_realm or sell_realm)
    if has_realm_filter:
        sorted_buy = ",".join(sorted(r.strip().lower() for r in (buy_realm or []) if r.strip()))
        sorted_sell = ",".join(sorted(r.strip().lower() for r in (sell_realm or []) if r.strip()))
        cache_key = f"scans.latest.realm:{sorted_buy}|{sorted_sell}"
        ttl = 10.0
    else:
        cache_key = f"scans.latest:{limit}"
        ttl = 20.0
    return _read_through_cache(
        cache_key,
        ttl,
        lambda: ScanLatestResponse(latest=get_latest_scan(db, SYSTEM_USER_ID, limit=limit, buy_realms=buy_realm, sell_realms=sell_realm)),
    )


@router.get("/scans/history", response_model=ScanHistoryResponse)
@limiter.limit("30/minute")
def scan_history(request: Request, db: Session = Depends(get_db), current_user: str | None = Depends(get_optional_user)) -> ScanHistoryResponse:
    del request
    del current_user
    return _read_through_cache("scans.history", 20.0, lambda: ScanHistoryResponse(scans=get_scan_history(db, SYSTEM_USER_ID)))


@router.get("/scans/calibration", response_model=ScanCalibrationSummaryRead)
@limiter.limit("18/minute")
def scan_calibration(request: Request, db: Session = Depends(get_db), current_user: str | None = Depends(get_optional_user)) -> ScanCalibrationSummaryRead:
    del request
    del current_user
    return _read_through_cache("scans.calibration", 20.0, lambda: get_calibration_summary(db, SYSTEM_USER_ID, days=30))


@router.get("/scans/readiness", response_model=ScanReadinessRead)
@limiter.limit("12/minute")
def scan_readiness(request: Request, db: Session = Depends(get_db), current_user: str | None = Depends(get_optional_user)) -> ScanReadinessRead:
    del request
    def _load() -> ScanReadinessRead:
        if current_user:
            realms = get_enabled_realm_names(db, current_user)
            readiness_user_id = current_user
        else:
            # Public scanner views consume scheduler/system scans; querying all users' tracked realms
            # can become expensive at scale and block readiness telemetry.
            realms = get_enabled_realm_names(db, SYSTEM_USER_ID)
            readiness_user_id = SYSTEM_USER_ID

        readiness = get_scan_readiness(db, readiness_user_id, realms=realms)
        if readiness.message != "Unable to assess scan readiness. Please try again in a moment.":
            return readiness

        latest_scan_summary = get_scan_history(db, SYSTEM_USER_ID, limit=1)
        if latest_scan_summary:
            latest = latest_scan_summary[0]
            return ScanReadinessRead(
                status="caution",
                ready_for_scan=latest.result_count > 0,
                message="Readiness detail is temporarily unavailable, but the latest scheduled scan data is available.",
                enabled_realm_count=len(realms),
                realms_with_data=len(realms),
                realms_with_fresh_data=len(realms),
                unique_item_count=int(latest.result_count or 0),
                items_missing_metadata=0,
                stale_realm_count=0,
                missing_realms=[],
                stale_realms=[],
                oldest_snapshot_at=None,
                latest_snapshot_at=latest.generated_at,
                realms=[],
            )

        return readiness

    identity = current_user or "guest"
    return _read_through_cache(f"scans.readiness:{identity}", 45.0, _load)


@router.get("/scans/status", response_model=ScanRuntimeStatusRead)
@limiter.limit("30/minute")
def scan_status(
    request: Request,
    buy_realm: str | None = Query(default=None),
    sell_realm: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: str | None = Depends(get_optional_user),
) -> ScanRuntimeStatusRead:
    del request

    def _derive_active_scope(buy_filter: str | None, sell_filter: str | None) -> str:
        tracked_key = "__tracked_realms__"
        all_key = "__all_realms__"
        buy = (buy_filter or tracked_key).strip()
        sell = (sell_filter or tracked_key).strip()
        if buy == all_key and sell == all_key:
            return "all_realms"
        if buy == tracked_key and sell == tracked_key:
            return "tracked_realms"
        if buy in {tracked_key, all_key} or sell in {tracked_key, all_key}:
            return "mixed"
        return "custom_realms"

    def _load() -> ScanRuntimeStatusRead:
        runtime_state = get_scan_runtime_state().__dict__
        scheduler_status = scheduler_manager.status()
        refresh_cycle = scheduler_status.get("refresh_cycle") if isinstance(scheduler_status, dict) else None
        next_scheduled_at = refresh_cycle.get("next_run_time") if isinstance(refresh_cycle, dict) else None

        latest_row = (
            db.query(ScanSession.id)
            .filter(ScanSession.user_id == SYSTEM_USER_ID)
            .order_by(ScanSession.generated_at.desc())
            .first()
        )
        latest_scan_id = int(latest_row.id) if latest_row else None
        latest_scan_result_count = int(
            db.query(func.count(ScanResult.id))
            .filter(ScanResult.scan_session_id == latest_scan_id)
            .scalar()
            or 0
        ) if latest_scan_id is not None else 0

        if latest_scan_id is not None:
            latest_buy_realm_count = int(
                db.query(func.count(func.distinct(ScanResult.cheapest_buy_realm)))
                .filter(ScanResult.scan_session_id == latest_scan_id)
                .scalar()
                or 0
            )
            latest_sell_realm_count = int(
                db.query(func.count(func.distinct(ScanResult.best_sell_realm)))
                .filter(ScanResult.scan_session_id == latest_scan_id)
                .scalar()
                or 0
            )
        else:
            latest_buy_realm_count = 0
            latest_sell_realm_count = 0

        tracked_realms = (
            get_enabled_realm_names(db, current_user)
            if current_user
            else get_enabled_realm_names(db, SYSTEM_USER_ID)
        )
        tracked_realm_count = len(tracked_realms)
        if tracked_realm_count == 0 and not current_user:
            tracked_realm_count = max(latest_buy_realm_count, latest_sell_realm_count)

        payload = {
            **runtime_state,
            "next_scheduled_at": next_scheduled_at,
            "diagnostic_active_scope": _derive_active_scope(buy_realm, sell_realm),
            "diagnostic_buy_filter": buy_realm,
            "diagnostic_sell_filter": sell_realm,
            "diagnostic_tracked_realm_count": tracked_realm_count,
            "diagnostic_latest_scan_id": latest_scan_id,
            "diagnostic_latest_scan_result_count": latest_scan_result_count,
            "diagnostic_latest_buy_realm_count": latest_buy_realm_count,
            "diagnostic_latest_sell_realm_count": latest_sell_realm_count,
        }
        return ScanRuntimeStatusRead.model_validate(payload)

    identity = current_user or "guest"
    cache_key = f"scans.status:{identity}:{buy_realm or '__tracked_realms__'}:{sell_realm or '__tracked_realms__'}"
    return _read_through_cache(cache_key, 10.0, _load)


@router.get("/scans/{scan_id}", response_model=ScanSessionRead)
def get_scan(
    scan_id: int,
    limit: int | None = Query(default=None, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: str | None = Depends(get_optional_user),
) -> ScanSessionRead:
    del current_user
    try:
        scan = get_scan_session(db, scan_id, SYSTEM_USER_ID, limit=limit)
    except Exception as exc:
        logger.error("Scan session query failed for scan_id=%s: %s", scan_id, exc)
        raise HTTPException(status_code=503, detail="Scan data temporarily unavailable.")
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return scan
