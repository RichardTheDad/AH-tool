from __future__ import annotations

from sqlalchemy import distinct
from sqlalchemy.orm import Session

from app.db.models import TrackedRealm
from app.schemas.tracked_realm import TrackedRealmCreate, TrackedRealmUpdate


def list_realms(session: Session, user_id: str) -> list[TrackedRealm]:
    return (
        session.query(TrackedRealm)
        .filter(TrackedRealm.user_id == user_id)
        .order_by(TrackedRealm.enabled.desc(), TrackedRealm.region.asc(), TrackedRealm.realm_name.asc())
        .all()
    )


def get_enabled_realm_names(session: Session, user_id: str) -> list[str]:
    return [row.realm_name for row in session.query(TrackedRealm).filter(TrackedRealm.user_id == user_id, TrackedRealm.enabled.is_(True)).all()]


def get_all_enabled_realm_names(session: Session) -> list[str]:
    """Return the distinct set of enabled realm names across all users (used by the background scheduler)."""
    rows = (
        session.query(distinct(TrackedRealm.realm_name))
        .filter(
            TrackedRealm.enabled.is_(True),
            TrackedRealm.realm_name.is_not(None),
            TrackedRealm.realm_name != "",
        )
        .all()
    )

    realms: list[str] = []
    seen: set[str] = set()
    for (raw_realm,) in rows:
        realm = str(raw_realm).strip()
        if not realm:
            continue
        normalized = realm.casefold()
        if normalized in seen:
            continue
        seen.add(normalized)
        realms.append(realm)
    return realms


def create_realm(session: Session, user_id: str, payload: TrackedRealmCreate) -> TrackedRealm:
    region = payload.region.strip().lower()
    existing = session.query(TrackedRealm).filter(
        TrackedRealm.user_id == user_id,
        TrackedRealm.region == region,
        TrackedRealm.realm_name.ilike(payload.realm_name),
    ).first()
    if existing:
        raise ValueError("Realm already tracked.")
    realm = TrackedRealm(user_id=user_id, **payload.model_dump(exclude={"region"}), region=region)
    session.add(realm)
    session.commit()
    session.refresh(realm)
    return realm


def update_realm(session: Session, user_id: str, realm_id: int, payload: TrackedRealmUpdate) -> TrackedRealm:
    realm = session.get(TrackedRealm, realm_id)
    if realm is None or realm.user_id != user_id:
        raise LookupError("Realm not found.")

    data = payload.model_dump(exclude_unset=True)
    if "region" in data and data["region"] is not None:
        data["region"] = data["region"].strip().lower()
    if "realm_name" in data or "region" in data:
        next_realm_name = data.get("realm_name", realm.realm_name)
        next_region = data.get("region", realm.region)
        duplicate = (
            session.query(TrackedRealm)
            .filter(
                TrackedRealm.user_id == user_id,
                TrackedRealm.region == next_region,
                TrackedRealm.realm_name.ilike(next_realm_name),
                TrackedRealm.id != realm_id,
            )
            .first()
        )
        if duplicate:
            raise ValueError("Realm already tracked.")

    for key, value in data.items():
        setattr(realm, key, value)
    session.commit()
    session.refresh(realm)
    return realm


def delete_realm(session: Session, user_id: str, realm_id: int) -> None:
    realm = session.get(TrackedRealm, realm_id)
    if realm is None or realm.user_id != user_id:
        raise LookupError("Realm not found.")
    session.delete(realm)
    session.commit()
