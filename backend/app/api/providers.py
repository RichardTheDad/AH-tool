from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_optional_user
from app.db.session import get_db
from app.schemas.provider import ProviderStatusResponse
from app.services.provider_service import get_provider_registry


router = APIRouter(tags=["providers"])


@router.get("/providers/status", response_model=ProviderStatusResponse)
def get_provider_status(db: Session = Depends(get_db), current_user: str | None = Depends(get_optional_user)) -> ProviderStatusResponse:
    return ProviderStatusResponse(providers=get_provider_registry().get_provider_statuses(db))
