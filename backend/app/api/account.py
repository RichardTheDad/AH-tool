from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.db.models import (
    AppSettings,
    RealmSuggestionRun,
    ScanPreset,
    ScanSession,
    ScoreCalibrationEvent,
    TrackedRealm,
    TuningActionAudit,
)
from app.db.session import get_db


router = APIRouter(tags=["account"])


@router.delete("/account", status_code=204)
def delete_account(db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> None:
    settings = get_settings()
    service_role_key = (settings.supabase_service_role_key or "").strip()
    if not service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account deletion is not configured on this environment.",
        )

    supabase_url = (settings.supabase_url or "").strip().rstrip("/")
    if not supabase_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account deletion is not configured on this environment.",
        )

    auth_url = f"{supabase_url}/auth/v1/admin/users/{current_user}"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.delete(auth_url, headers=headers, json={"should_soft_delete": True})
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to delete account in authentication provider.",
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to delete account in authentication provider.",
        ) from exc

    db.query(TrackedRealm).filter(TrackedRealm.user_id == current_user).delete(synchronize_session=False)
    db.query(ScanPreset).filter(ScanPreset.user_id == current_user).delete(synchronize_session=False)
    db.query(RealmSuggestionRun).filter(RealmSuggestionRun.user_id == current_user).delete(synchronize_session=False)
    db.query(AppSettings).filter(AppSettings.user_id == current_user).delete(synchronize_session=False)
    db.query(TuningActionAudit).filter(TuningActionAudit.user_id == current_user).delete(synchronize_session=False)
    db.query(ScoreCalibrationEvent).filter(ScoreCalibrationEvent.user_id == current_user).delete(synchronize_session=False)
    db.query(ScanSession).filter(ScanSession.user_id == current_user).delete(synchronize_session=False)
    db.commit()
