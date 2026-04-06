from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import ScanPreset
from app.schemas.preset import ScanPresetCreate, ScanPresetUpdate


def list_presets(session: Session) -> list[ScanPreset]:
    return session.query(ScanPreset).order_by(ScanPreset.name.asc()).all()


def get_preset(session: Session, preset_id: int) -> ScanPreset | None:
    return session.get(ScanPreset, preset_id)


def create_preset(session: Session, payload: ScanPresetCreate) -> ScanPreset:
    duplicate = session.query(ScanPreset).filter(ScanPreset.name.ilike(payload.name)).first()
    if duplicate:
        raise ValueError("Preset name already exists.")
    preset = ScanPreset(**payload.model_dump())
    session.add(preset)
    session.commit()
    session.refresh(preset)
    return preset


def update_preset(session: Session, preset_id: int, payload: ScanPresetUpdate) -> ScanPreset:
    preset = session.get(ScanPreset, preset_id)
    if preset is None:
        raise LookupError("Preset not found.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        duplicate = session.query(ScanPreset).filter(ScanPreset.name.ilike(data["name"]), ScanPreset.id != preset_id).first()
        if duplicate:
            raise ValueError("Preset name already exists.")

    for key, value in data.items():
        setattr(preset, key, value)
    session.commit()
    session.refresh(preset)
    return preset


def delete_preset(session: Session, preset_id: int) -> None:
    preset = session.get(ScanPreset, preset_id)
    if preset is None:
        raise LookupError("Preset not found.")
    session.delete(preset)
    session.commit()

