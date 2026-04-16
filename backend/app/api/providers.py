from __future__ import annotations

from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.auth import get_optional_user
from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.provider import ProviderStatusResponse
from app.services.provider_service import get_provider_registry


router = APIRouter(tags=["providers"])

_CACHE_LOCK = Lock()
_STATUS_CACHE: tuple[float, ProviderStatusResponse] | None = None


@router.get("/providers/status", response_model=ProviderStatusResponse)
@limiter.limit("30/minute")
def get_provider_status(request: Request, db: Session = Depends(get_db), current_user: str | None = Depends(get_optional_user)) -> ProviderStatusResponse:
    global _STATUS_CACHE
    del request
    del current_user

    now = monotonic()
    with _CACHE_LOCK:
        if _STATUS_CACHE and now - _STATUS_CACHE[0] <= 20.0:
            return _STATUS_CACHE[1]

    response = ProviderStatusResponse(providers=get_provider_registry().get_provider_statuses(db))
    with _CACHE_LOCK:
        _STATUS_CACHE = (now, response)
    return response
