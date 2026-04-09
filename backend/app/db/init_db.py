from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models import (
    AppSettings,
    Item,
    ListingSnapshot,
    RealmSuggestionRecommendation,
    RealmSuggestionRun,
    ScanPreset,
    ScanSession,
    TrackedRealm,
)
from app.db.session import get_engine


NON_PRODUCTION_SOURCES = {"seed", "mock"}
APP_DATA_RETENTION_DAYS = 30


def create_db_and_tables() -> None:
    engine = get_engine()
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                DELETE FROM listing_snapshots
                WHERE id IN (
                    SELECT duplicate_id
                    FROM (
                        SELECT snapshots.id AS duplicate_id
                        FROM listing_snapshots AS snapshots
                        JOIN (
                            SELECT item_id, realm, source_name, captured_at, MIN(id) AS keep_id
                            FROM listing_snapshots
                            GROUP BY item_id, realm, source_name, captured_at
                            HAVING COUNT(*) > 1
                        ) AS duplicates
                            ON snapshots.item_id = duplicates.item_id
                            AND snapshots.realm = duplicates.realm
                            AND snapshots.source_name = duplicates.source_name
                            AND snapshots.captured_at = duplicates.captured_at
                        WHERE snapshots.id <> duplicates.keep_id
                    )
                )
                """
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_listing_snapshots_item_realm_captured "
                "ON listing_snapshots(item_id, realm, captured_at)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_listing_snapshots_realm_item_captured "
                "ON listing_snapshots(realm, item_id, captured_at)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_listing_snapshots_source_realm_captured "
                "ON listing_snapshots(source_name, realm, captured_at)"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_listing_snapshots_exact "
                "ON listing_snapshots(item_id, realm, source_name, captured_at)"
            )
        )
        existing_scan_result_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info('scan_results')")).fetchall()
        }
        existing_realm_suggestion_run_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info('realm_suggestion_runs')")).fetchall()
        }
        if "sellability_score" not in existing_scan_result_columns:
            connection.execute(text("ALTER TABLE scan_results ADD COLUMN sellability_score FLOAT DEFAULT 0"))
        if "turnover_label" not in existing_scan_result_columns:
            connection.execute(text("ALTER TABLE scan_results ADD COLUMN turnover_label VARCHAR(24) DEFAULT 'slow'"))
        if "source_realms_json" not in existing_realm_suggestion_run_columns:
            connection.execute(text("ALTER TABLE realm_suggestion_runs ADD COLUMN source_realms_json JSON"))
        if "target_set_key" not in existing_realm_suggestion_run_columns:
            connection.execute(text("ALTER TABLE realm_suggestion_runs ADD COLUMN target_set_key VARCHAR(255)"))
            connection.execute(
                text(
                    """
                    UPDATE realm_suggestion_runs
                    SET target_set_key = CASE
                        WHEN target_realms_json IS NULL OR target_realms_json = '[]' THEN NULL
                        ELSE lower(
                            replace(
                                replace(
                                    replace(
                                        replace(target_realms_json, '["', ''),
                                        '"]',
                                        ''
                                    ),
                                    '", "',
                                    '|'
                                ),
                                '","',
                                '|'
                            )
                        )
                    END
                    """
                )
            )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_realm_suggestion_runs_target_set_key "
                "ON realm_suggestion_runs(target_set_key)"
            )
        )
        existing_realm_suggestion_recommendation_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info('realm_suggestion_recommendations')")).fetchall()
        }
        if "median_buy_price" not in existing_realm_suggestion_recommendation_columns:
            connection.execute(text("ALTER TABLE realm_suggestion_recommendations ADD COLUMN median_buy_price FLOAT"))
        if "best_target_realm" not in existing_realm_suggestion_recommendation_columns:
            connection.execute(text("ALTER TABLE realm_suggestion_recommendations ADD COLUMN best_target_realm VARCHAR(120)"))


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


def purge_app_runtime_data(session: Session) -> None:
    try:
        session.execute(text("DELETE FROM realm_suggestion_recommendations"))
        session.execute(text("DELETE FROM realm_suggestion_runs"))
        session.execute(text("DELETE FROM scan_results"))
        session.execute(text("DELETE FROM scan_sessions"))
        session.execute(text("DELETE FROM listing_snapshots"))
        session.execute(
            text(
                """
                DELETE FROM items
                WHERE item_id NOT IN (
                    SELECT DISTINCT item_id FROM listing_snapshots
                )
                """
            )
        )
        session.commit()
    except Exception:
        session.rollback()
        raise


def purge_expired_app_data(session: Session, *, retention_days: int = APP_DATA_RETENTION_DAYS) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    try:
        expired_realm_suggestion_runs = session.query(RealmSuggestionRun).filter(RealmSuggestionRun.generated_at < cutoff).all()
        for suggestion_run in expired_realm_suggestion_runs:
            session.delete(suggestion_run)
        session.flush()

        expired_sessions = session.query(ScanSession).filter(ScanSession.generated_at < cutoff).all()
        for scan_session in expired_sessions:
            session.delete(scan_session)
        session.flush()

        session.query(ListingSnapshot).filter(ListingSnapshot.captured_at < cutoff).delete(synchronize_session=False)
        session.flush()

        session.execute(
            text(
                """
                DELETE FROM items
                WHERE item_id NOT IN (
                    SELECT DISTINCT item_id FROM listing_snapshots
                )
                """
            )
        )
        session.commit()
    except Exception:
        session.rollback()
        raise


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
    purge_expired_app_data(session)
    ensure_defaults(session)
