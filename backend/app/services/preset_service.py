from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import ScanPreset
from app.schemas.preset import ScanPresetCreate, ScanPresetUpdate


def _normalize_realm_list(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in values:
        realm = raw.strip()
        if not realm:
            continue
        key = realm.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(realm)
    return cleaned or None


def _normalize_payload(data: dict[str, object]) -> dict[str, object]:
    normalized = dict(data)
    if "buy_realms" in normalized:
        normalized["buy_realms"] = _normalize_realm_list(normalized.get("buy_realms"))
    if "sell_realms" in normalized:
        normalized["sell_realms"] = _normalize_realm_list(normalized.get("sell_realms"))
    return normalized


def _ensure_default_presets(session: Session, user_id: str) -> None:
    if session.query(ScanPreset.id).filter(ScanPreset.user_id == user_id).first() is not None:
        return
    session.add_all(
        [
            ScanPreset(user_id=user_id, name="Safe Floor", min_profit=5000, min_roi=0.2, min_confidence=70, hide_risky=True, is_default=False),
            ScanPreset(user_id=user_id, name="Balanced Board", min_profit=2500, min_roi=0.12, min_confidence=55, hide_risky=True, is_default=True),
            ScanPreset(user_id=user_id, name="Aggressive Peek", min_profit=1000, min_roi=0.08, min_confidence=35, hide_risky=False),
        ]
    )
    session.commit()


def _clear_default(session: Session, user_id: str, *, exclude_preset_id: int | None = None) -> None:
    query = session.query(ScanPreset).filter(ScanPreset.user_id == user_id, ScanPreset.is_default.is_(True))
    if exclude_preset_id is not None:
        query = query.filter(ScanPreset.id != exclude_preset_id)
    for preset in query.all():
        preset.is_default = False


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
    preset_data = _normalize_payload(payload.model_dump())
    has_existing_default = bool(
        session.query(ScanPreset.id).filter(ScanPreset.user_id == user_id, ScanPreset.is_default.is_(True)).first()
    )
    preset = ScanPreset(user_id=user_id, is_default=not has_existing_default, **preset_data)
    session.add(preset)
    session.commit()
    session.refresh(preset)
    return preset


def update_preset(session: Session, user_id: str, preset_id: int, payload: ScanPresetUpdate) -> ScanPreset:
    preset = session.get(ScanPreset, preset_id)
    if preset is None or preset.user_id != user_id:
        raise LookupError("Preset not found.")

    data = _normalize_payload(payload.model_dump(exclude_unset=True))
    if "name" in data:
        duplicate = session.query(ScanPreset).filter(
            ScanPreset.user_id == user_id, ScanPreset.name.ilike(data["name"]), ScanPreset.id != preset_id
        ).first()
        if duplicate:
            raise ValueError("Preset name already exists.")

    if data.get("is_default") is True:
        _clear_default(session, user_id, exclude_preset_id=preset_id)

    for key, value in data.items():
        setattr(preset, key, value)

    if preset.is_default is not True:
        has_default = bool(
            session.query(ScanPreset.id)
            .filter(ScanPreset.user_id == user_id, ScanPreset.is_default.is_(True), ScanPreset.id != preset_id)
            .first()
        )
        if not has_default:
            preset.is_default = True

    session.commit()
    session.refresh(preset)
    return preset


def delete_preset(session: Session, user_id: str, preset_id: int) -> None:
    preset = session.get(ScanPreset, preset_id)
    if preset is None or preset.user_id != user_id:
        raise LookupError("Preset not found.")
    deleted_was_default = bool(preset.is_default)
    session.delete(preset)
    session.flush()
    if deleted_was_default:
        replacement = (
            session.query(ScanPreset)
            .filter(ScanPreset.user_id == user_id)
            .order_by(ScanPreset.name.asc())
            .first()
        )
        if replacement is not None:
            replacement.is_default = True
    session.commit()


def get_default_preset(session: Session, user_id: str) -> ScanPreset | None:
    _ensure_default_presets(session, user_id)
    preset = (
        session.query(ScanPreset)
        .filter(ScanPreset.user_id == user_id, ScanPreset.is_default.is_(True))
        .first()
    )
    if preset is not None:
        return preset
    fallback = (
        session.query(ScanPreset)
        .filter(ScanPreset.user_id == user_id)
        .order_by(ScanPreset.name.asc())
        .first()
    )
    if fallback is None:
        return None
    fallback.is_default = True
    session.commit()
    session.refresh(fallback)
    return fallback


def set_default_preset(session: Session, user_id: str, preset_id: int) -> ScanPreset:
    preset = get_preset(session, user_id, preset_id)
    if preset is None:
        raise LookupError("Preset not found.")
    _clear_default(session, user_id, exclude_preset_id=preset_id)
    preset.is_default = True
    session.commit()
    session.refresh(preset)
    return preset


def clear_default_preset(session: Session, user_id: str) -> None:
    _clear_default(session, user_id)
    session.commit()

