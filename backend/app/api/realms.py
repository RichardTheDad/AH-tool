from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.mutation_limiter import enforce_user_mutation_limit
from app.db.session import get_db
from app.schemas.tracked_realm import TrackedRealmCreate, TrackedRealmRead, TrackedRealmUpdate
from app.services import realm_service


router = APIRouter(tags=["realms"])


@router.get("/realms", response_model=list[TrackedRealmRead])
def list_realms(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> list[TrackedRealmRead]:
    return [TrackedRealmRead.model_validate(realm) for realm in realm_service.list_realms(db, current_user)]


@router.post("/realms", response_model=TrackedRealmRead, status_code=status.HTTP_201_CREATED)
def create_realm(payload: TrackedRealmCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> TrackedRealmRead:
    enforce_user_mutation_limit(user_id=current_user, scope="realms.create", limit=10)
    try:
        realm = realm_service.create_realm(db, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TrackedRealmRead.model_validate(realm)


@router.put("/realms/{realm_id}", response_model=TrackedRealmRead)
def update_realm(realm_id: int, payload: TrackedRealmUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> TrackedRealmRead:
    enforce_user_mutation_limit(user_id=current_user, scope="realms.update", limit=10)
    try:
        realm = realm_service.update_realm(db, current_user, realm_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TrackedRealmRead.model_validate(realm)


@router.delete("/realms/{realm_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_realm(realm_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> None:
    enforce_user_mutation_limit(user_id=current_user, scope="realms.delete", limit=10)
    try:
        realm_service.delete_realm(db, current_user, realm_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
