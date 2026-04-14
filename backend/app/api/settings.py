from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.init_db import provision_new_user
from app.db.models import AppSettings, TuningActionAudit
from app.db.session import get_db
from app.jobs.scheduler import manager as scheduler_manager
from app.schemas.settings import (
    AppSettingsApplyPresetRequest,
    AppSettingsRead,
    AppSettingsUpdate,
    TuningActionAuditListRead,
    TuningActionAuditRead,
)


router = APIRouter(tags=["settings"])
TUNING_ACTION_COOLDOWN_MINUTES = 30


def _settings_snapshot(app_settings: AppSettings) -> dict[str, object]:
    return {
        "ah_cut_percent": float(app_settings.ah_cut_percent),
        "flat_buffer": float(app_settings.flat_buffer),
        "refresh_interval_minutes": int(app_settings.refresh_interval_minutes),
        "stale_after_minutes": int(app_settings.stale_after_minutes),
        "scoring_preset": app_settings.scoring_preset,
        "non_commodity_only": bool(app_settings.non_commodity_only),
    }


def _get_or_provision_settings(db: Session, user_id: str) -> AppSettings:
    app_settings = db.query(AppSettings).filter(AppSettings.user_id == user_id).first()
    if app_settings is None:
        provision_new_user(db, user_id)
        app_settings = db.query(AppSettings).filter(AppSettings.user_id == user_id).first()
    return app_settings  # type: ignore[return-value]


@router.get("/settings", response_model=AppSettingsRead)
def get_settings_route(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> AppSettingsRead:
    return AppSettingsRead.model_validate(_get_or_provision_settings(db, current_user))


@router.put("/settings", response_model=AppSettingsRead)
def update_settings(payload: AppSettingsUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> AppSettingsRead:
    app_settings = _get_or_provision_settings(db, current_user)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(app_settings, key, value)

    db.commit()
    db.refresh(app_settings)
    return AppSettingsRead.model_validate(app_settings)


@router.post("/settings/apply-tuning-preset", response_model=AppSettingsRead)
def apply_tuning_preset(payload: AppSettingsApplyPresetRequest, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> AppSettingsRead:
    app_settings = _get_or_provision_settings(db, current_user)

    labels = {
        "safe_calibration": "Apply safer tuning",
        "balanced_default": "Restore balanced tuning",
    }
    action_label = labels.get(payload.preset_id, payload.preset_id)
    now = datetime.now(timezone.utc)

    last_success = (
        db.query(TuningActionAudit)
        .filter(TuningActionAudit.user_id == current_user, TuningActionAudit.blocked.is_(False))
        .order_by(TuningActionAudit.applied_at.desc())
        .first()
    )
    if last_success is not None:
        last_applied_at = last_success.applied_at
        if last_applied_at.tzinfo is None:
            last_applied_at = last_applied_at.replace(tzinfo=timezone.utc)
        elapsed = now - last_applied_at
        cooldown = timedelta(minutes=TUNING_ACTION_COOLDOWN_MINUTES)
        if elapsed < cooldown:
            remaining = cooldown - elapsed
            remaining_minutes = max(1, int(remaining.total_seconds() // 60))
            db.add(
                TuningActionAudit(
                    user_id=current_user,
                    action_id=payload.preset_id,
                    action_label=action_label,
                    source="scanner_suggestion",
                    applied_at=now,
                    blocked=True,
                    blocked_reason=f"Cooldown active. Try again in about {remaining_minutes} minute(s).",
                    previous_settings_json=_settings_snapshot(app_settings),
                    resulting_settings_json=_settings_snapshot(app_settings),
                )
            )
            db.commit()
            raise HTTPException(status_code=429, detail=f"Tuning cooldown active. Try again in about {remaining_minutes} minute(s).")

    previous_settings = _settings_snapshot(app_settings)

    if payload.preset_id == "safe_calibration":
        app_settings.scoring_preset = "safe"
        app_settings.non_commodity_only = True
        app_settings.stale_after_minutes = min(int(app_settings.stale_after_minutes or 120), 120)
    elif payload.preset_id == "balanced_default":
        app_settings.scoring_preset = "balanced"
    else:
        raise HTTPException(status_code=400, detail="Unknown tuning preset.")

    db.add(
        TuningActionAudit(
            user_id=current_user,
            action_id=payload.preset_id,
            action_label=action_label,
            source="scanner_suggestion",
            applied_at=now,
            blocked=False,
            blocked_reason=None,
            previous_settings_json=previous_settings,
            resulting_settings_json=_settings_snapshot(app_settings),
        )
    )
    db.commit()
    db.refresh(app_settings)
    return AppSettingsRead.model_validate(app_settings)


@router.get("/settings/tuning-audit", response_model=TuningActionAuditListRead)
def get_tuning_action_audit(
    limit: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
) -> TuningActionAuditListRead:
    entries = db.query(TuningActionAudit).filter(TuningActionAudit.user_id == current_user).order_by(TuningActionAudit.applied_at.desc()).limit(limit).all()
    return TuningActionAuditListRead(entries=[TuningActionAuditRead.model_validate(entry) for entry in entries])
