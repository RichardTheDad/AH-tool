from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models import AppSettings, Item, ListingSnapshot, ScanPreset, ScanSession, TrackedRealm
from app.db.session import get_engine


NON_PRODUCTION_SOURCES = {"seed", "mock"}


def create_db_and_tables() -> None:
    Base.metadata.create_all(get_engine())


def ensure_defaults(session: Session) -> None:
    if session.get(AppSettings, 1) is None:
        session.add(AppSettings(id=1))

    if not session.query(ScanPreset).count():
        session.add_all(
            [
                ScanPreset(name="Safe Floor", min_profit=5000, min_roi=0.2, min_confidence=70, hide_risky=True),
                ScanPreset(name="Balanced Board", min_profit=2500, min_roi=0.12, min_confidence=55, hide_risky=True),
                ScanPreset(name="Aggressive Peek", min_profit=1000, min_roi=0.08, min_confidence=35, hide_risky=False),
            ]
        )
    session.commit()


def _is_legacy_nonproduction_item(item: Item) -> bool:
    metadata = item.metadata_json
    if not isinstance(metadata, dict):
        return False
    return bool(metadata.get("demo")) or metadata.get("source") in {"seed", "demo_catalog"}


def purge_legacy_nonproduction_data(session: Session) -> None:
    nonproduction_items = [item for item in session.query(Item).all() if _is_legacy_nonproduction_item(item)]
    has_nonproduction_snapshots = (
        session.query(ListingSnapshot).filter(ListingSnapshot.source_name.in_(NON_PRODUCTION_SOURCES)).first() is not None
    )
    has_mock_scans = session.query(ScanSession).filter(ScanSession.provider_name == "mock").first() is not None
    has_user_snapshots = session.query(ListingSnapshot).filter(~ListingSnapshot.source_name.in_(NON_PRODUCTION_SOURCES)).first() is not None
    legacy_nonproduction_present = bool(nonproduction_items) or has_nonproduction_snapshots or has_mock_scans

    if has_user_snapshots:
        scan_sessions = session.query(ScanSession).filter(ScanSession.provider_name == "mock").all()
    elif legacy_nonproduction_present:
        scan_sessions = session.query(ScanSession).all()
    else:
        scan_sessions = []

    for scan_session in scan_sessions:
        session.delete(scan_session)

    for snapshot in session.query(ListingSnapshot).filter(ListingSnapshot.source_name.in_(NON_PRODUCTION_SOURCES)).all():
        session.delete(snapshot)

    if legacy_nonproduction_present and not has_user_snapshots:
        for realm in session.query(TrackedRealm).all():
            session.delete(realm)

    session.flush()

    for item in nonproduction_items:
        has_snapshots = session.query(ListingSnapshot.id).filter(ListingSnapshot.item_id == item.item_id).first() is not None
        if not has_snapshots:
            session.delete(item)
            continue

        # Preserve imported listings that reference the item id, but replace
        # fake metadata with an explicit missing-metadata state.
        item.name = f"Item {item.item_id} (metadata unavailable)"
        item.class_name = None
        item.subclass_name = None
        item.quality = None
        item.icon_url = None
        item.metadata_json = {
            "source": "unresolved_import",
            "metadata_status": "missing",
        }
        item.metadata_updated_at = None
        item.is_commodity = False

    session.commit()


def initialize_app_data(session: Session) -> None:
    purge_legacy_nonproduction_data(session)
    ensure_defaults(session)
