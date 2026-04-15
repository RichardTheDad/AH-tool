from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import ScanPreset
from app.schemas.preset import ScanPresetCreate, ScanPresetUpdate


def _ensure_default_presets(session: Session, user_id: str) -> None:
    if session.query(ScanPreset.id).filter(ScanPreset.user_id == user_id).first() is not None:
        return
    session.add_all(
        [
            ScanPreset(user_id=user_id, name="Safe Floor", min_profit=5000, min_roi=0.2, min_confidence=70, hide_risky=True),
            ScanPreset(user_id=user_id, name="Balanced Board", min_profit=2500, min_roi=0.12, min_confidence=55, hide_risky=True),
            ScanPreset(user_id=user_id, name="Aggressive Peek", min_profit=1000, min_roi=0.08, min_confidence=35, hide_risky=False),
        ]
    )
    session.commit()


def list_presets(session: Session, user_id: str) -> list[ScanPreset]:
    _ensure_default_presets(session, user_id)
    return session.query(ScanPreset).filter(ScanPreset.user_id == user_id).order_by(ScanPreset.name.asc()).all()


def get_preset(session: Session, user_id: str, preset_id: int) -> ScanPreset | None:
    preset = session.get(ScanPreset, preset_id)
    if preset is None or preset.user_id != user_id:
        return None
    return preset


def create_preset(session: Session, user_id: str, payload: ScanPresetCreate) -> ScanPreset:
    duplicate = session.query(ScanPreset).filter(ScanPreset.user_id == user_id, ScanPreset.name.ilike(payload.name)).first()
    if duplicate:
        raise ValueError("Preset name already exists.")
    preset = ScanPreset(user_id=user_id, **payload.model_dump())
    session.add(preset)
    session.commit()
    session.refresh(preset)
    return preset


def update_preset(session: Session, user_id: str, preset_id: int, payload: ScanPresetUpdate) -> ScanPreset:
    preset = session.get(ScanPreset, preset_id)
    if preset is None or preset.user_id != user_id:
        raise LookupError("Preset not found.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        duplicate = session.query(ScanPreset).filter(
            ScanPreset.user_id == user_id, ScanPreset.name.ilike(data["name"]), ScanPreset.id != preset_id
        ).first()
        if duplicate:
            raise ValueError("Preset name already exists.")

    for key, value in data.items():
        setattr(preset, key, value)
    session.commit()
    session.refresh(preset)
    return preset


def delete_preset(session: Session, user_id: str, preset_id: int) -> None:
    preset = session.get(ScanPreset, preset_id)
    if preset is None or preset.user_id != user_id:
        raise LookupError("Preset not found.")
    session.delete(preset)
    session.commit()

