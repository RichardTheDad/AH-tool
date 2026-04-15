from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.mutation_limiter import enforce_user_mutation_limit
from app.db.session import get_db
from app.schemas.preset import ScanPresetCreate, ScanPresetRead, ScanPresetUpdate
from app.services import preset_service


router = APIRouter(tags=["presets"])


@router.get("/presets", response_model=list[ScanPresetRead])
def list_presets(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> list[ScanPresetRead]:
    return [ScanPresetRead.model_validate(preset) for preset in preset_service.list_presets(db, current_user)]


@router.get("/presets/default", response_model=ScanPresetRead | None)
def get_default_preset(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> ScanPresetRead | None:
    preset = preset_service.get_default_preset(db, current_user)
    if preset is None:
        return None
    return ScanPresetRead.model_validate(preset)


@router.post("/presets", response_model=ScanPresetRead, status_code=status.HTTP_201_CREATED)
def create_preset(payload: ScanPresetCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> ScanPresetRead:
    enforce_user_mutation_limit(user_id=current_user, scope="presets.create", limit=10)
    try:
        preset = preset_service.create_preset(db, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ScanPresetRead.model_validate(preset)


@router.put("/presets/{preset_id}", response_model=ScanPresetRead)
def update_preset(preset_id: int, payload: ScanPresetUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> ScanPresetRead:
    enforce_user_mutation_limit(user_id=current_user, scope="presets.update", limit=10)
    try:
        preset = preset_service.update_preset(db, current_user, preset_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ScanPresetRead.model_validate(preset)


@router.delete("/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_preset(preset_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> None:
    enforce_user_mutation_limit(user_id=current_user, scope="presets.delete", limit=10)
    try:
        preset_service.delete_preset(db, current_user, preset_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/presets/{preset_id}/set-default", response_model=ScanPresetRead)
def set_default_preset(preset_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> ScanPresetRead:
    enforce_user_mutation_limit(user_id=current_user, scope="presets.set_default", limit=10)
    try:
        preset = preset_service.set_default_preset(db, current_user, preset_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ScanPresetRead.model_validate(preset)


@router.delete("/presets/default", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def clear_default_preset(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> None:
    enforce_user_mutation_limit(user_id=current_user, scope="presets.clear_default", limit=10)
    preset_service.clear_default_preset(db, current_user)
