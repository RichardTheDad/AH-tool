from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import AppSettings
from app.db.session import get_db
from app.jobs.scheduler import manager as scheduler_manager
from app.schemas.settings import AppSettingsRead, AppSettingsUpdate


router = APIRouter(tags=["settings"])


@router.get("/settings", response_model=AppSettingsRead)
def get_settings_route(db: Session = Depends(get_db)) -> AppSettingsRead:
    app_settings = db.get(AppSettings, 1)
    if app_settings is None:
        app_settings = AppSettings(id=1)
        db.add(app_settings)
        db.commit()
        db.refresh(app_settings)
    return AppSettingsRead.model_validate(app_settings)


@router.put("/settings", response_model=AppSettingsRead)
def update_settings(payload: AppSettingsUpdate, db: Session = Depends(get_db)) -> AppSettingsRead:
    app_settings = db.get(AppSettings, 1)
    if app_settings is None:
        app_settings = AppSettings(id=1)
        db.add(app_settings)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(app_settings, key, value)

    db.commit()
    db.refresh(app_settings)
    scheduler_manager.reconfigure()
    return AppSettingsRead.model_validate(app_settings)
