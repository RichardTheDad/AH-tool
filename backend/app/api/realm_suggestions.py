from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.realm_suggestion import SuggestedRealmLatestResponse, SuggestedRealmReportRead, SuggestedRealmRunRequest
from app.services.realm_suggestion_service import get_latest_realm_suggestions, run_realm_suggestions


router = APIRouter(tags=["realm-suggestions"])


def _parse_target_realms(raw_target_realms: str | None) -> list[str] | None:
    if raw_target_realms is None:
        return None
    realms = [realm.strip() for realm in raw_target_realms.split(",") if realm.strip()]
    return realms


@router.get("/realm-suggestions/latest", response_model=SuggestedRealmLatestResponse)
def latest_realm_suggestions(
    target_realms: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
) -> SuggestedRealmLatestResponse:
    return SuggestedRealmLatestResponse(latest=get_latest_realm_suggestions(db, current_user, target_realms=_parse_target_realms(target_realms)))


@router.post("/realm-suggestions/run", response_model=SuggestedRealmReportRead)
@limiter.limit("1/5minutes")
def run_realm_suggestions_route(
    request: Request,
    payload: SuggestedRealmRunRequest | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
) -> SuggestedRealmReportRead:
    request_payload = payload or SuggestedRealmRunRequest()
    return run_realm_suggestions(db, current_user, target_realms=request_payload.target_realms)
