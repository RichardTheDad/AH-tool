from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import TrackedRealm
from app.schemas.tracked_realm import TrackedRealmCreate, TrackedRealmUpdate


def list_realms(session: Session) -> list[TrackedRealm]:
    return session.query(TrackedRealm).order_by(TrackedRealm.enabled.desc(), TrackedRealm.realm_name.asc()).all()


def get_enabled_realm_names(session: Session) -> list[str]:
    return [row.realm_name for row in session.query(TrackedRealm).filter(TrackedRealm.enabled.is_(True)).all()]


def create_realm(session: Session, payload: TrackedRealmCreate) -> TrackedRealm:
    existing = session.query(TrackedRealm).filter(TrackedRealm.realm_name.ilike(payload.realm_name)).first()
    if existing:
        raise ValueError("Realm already tracked.")
    realm = TrackedRealm(**payload.model_dump())
    session.add(realm)
    session.commit()
    session.refresh(realm)
    return realm


def update_realm(session: Session, realm_id: int, payload: TrackedRealmUpdate) -> TrackedRealm:
    realm = session.get(TrackedRealm, realm_id)
    if realm is None:
        raise LookupError("Realm not found.")

    data = payload.model_dump(exclude_unset=True)
    if "realm_name" in data:
        duplicate = (
            session.query(TrackedRealm)
            .filter(TrackedRealm.realm_name.ilike(data["realm_name"]), TrackedRealm.id != realm_id)
            .first()
        )
        if duplicate:
            raise ValueError("Realm already tracked.")

    for key, value in data.items():
        setattr(realm, key, value)
    session.commit()
    session.refresh(realm)
    return realm


def delete_realm(session: Session, realm_id: int) -> None:
    realm = session.get(TrackedRealm, realm_id)
    if realm is None:
        raise LookupError("Realm not found.")
    session.delete(realm)
    session.commit()

