from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models import (
    AppSettings,
    Item,
    ListingSnapshot,
    RealmSuggestionRecommendation,
    RealmSuggestionRun,
    ScoreCalibrationEvent,
    ScanPreset,
    ScanSession,
    TuningActionAudit,
    TrackedRealm,
)
from app.db.session import get_engine
from app.core.config import SYSTEM_USER_ID, get_settings


NON_PRODUCTION_SOURCES = {"seed", "mock"}
APP_DATA_RETENTION_DAYS = 30


def create_db_and_tables() -> None:
    database_url = get_settings().database_url
    if not database_url.startswith("sqlite"):
        # PostgreSQL: schema is managed by Alembic migrations, not create_all.
        return

    engine = get_engine()
    Base.metadata.create_all(engine)

    # --- SQLite-specific post-creation migrations ---
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
        existing_scan_preset_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info('scan_presets')")).fetchall()
        }
        existing_realm_suggestion_run_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info('realm_suggestion_runs')")).fetchall()
        }
        if "sellability_score" not in existing_scan_result_columns:
            connection.execute(text("ALTER TABLE scan_results ADD COLUMN sellability_score FLOAT DEFAULT 0"))
        if "turnover_label" not in existing_scan_result_columns:
            connection.execute(text("ALTER TABLE scan_results ADD COLUMN turnover_label VARCHAR(24) DEFAULT 'slow'"))
        if "score_provenance_json" not in existing_scan_result_columns:
            connection.execute(text("ALTER TABLE scan_results ADD COLUMN score_provenance_json JSON"))
        if "buy_realms" not in existing_scan_preset_columns:
            connection.execute(text("ALTER TABLE scan_presets ADD COLUMN buy_realms JSON"))
        if "sell_realms" not in existing_scan_preset_columns:
            connection.execute(text("ALTER TABLE scan_presets ADD COLUMN sell_realms JSON"))
        if "is_default" not in existing_scan_preset_columns:
            connection.execute(text("ALTER TABLE scan_presets ADD COLUMN is_default BOOLEAN DEFAULT 0"))
            connection.execute(
                text(
                    """
                    UPDATE scan_presets
                    SET is_default = 1
                    WHERE id IN (
                        SELECT MIN(id)
                        FROM scan_presets
                        GROUP BY user_id
                    )
                    """
                )
            )

        existing_calibration_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info('score_calibration_events')")).fetchall()
        }
        if existing_calibration_columns and "horizon_outcomes_json" not in existing_calibration_columns:
            connection.execute(text("ALTER TABLE score_calibration_events ADD COLUMN horizon_outcomes_json JSON"))
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
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_score_calibration_events_generated "
                "ON score_calibration_events(generated_at)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_score_calibration_events_due "
                "ON score_calibration_events(evaluation_due_at, evaluated_at)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_tuning_action_audit_applied "
                "ON tuning_action_audit(applied_at)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_tuning_action_audit_action "
                "ON tuning_action_audit(action_id, applied_at)"
            )
        )


def provision_new_user(session: Session, user_id: str) -> None:
    """Create default AppSettings and ScanPresets for a new user if they don't already exist."""
    existing_settings = session.query(AppSettings).filter(AppSettings.user_id == user_id).first()
    if existing_settings is None:
        session.add(AppSettings(user_id=user_id))

    if not session.query(ScanPreset).filter(ScanPreset.user_id == user_id).count():
        session.add_all(
            [
                ScanPreset(user_id=user_id, name="Safe Floor", min_profit=5000, min_roi=0.2, min_confidence=70, hide_risky=True, is_default=False),
                ScanPreset(user_id=user_id, name="Balanced Board", min_profit=2500, min_roi=0.12, min_confidence=55, hide_risky=True, is_default=True),
                ScanPreset(user_id=user_id, name="Aggressive Peek", min_profit=1000, min_roi=0.08, min_confidence=35, hide_risky=False),
            ]
        )
    session.commit()


def migrate_to_system_user(session: Session) -> None:
    """Migrate shared scanner tables to a single global user id.

    This is idempotent and intentionally leaves per-user realms and presets intact.
    """
    non_system_count = int(
        session.query(func.count(AppSettings.id)).filter(AppSettings.user_id != SYSTEM_USER_ID).scalar() or 0
    )
    has_non_system_scan_sessions = bool(
        session.query(ScanSession.id).filter(ScanSession.user_id != SYSTEM_USER_ID).first()
    )
    has_non_system_tuning_audit = bool(
        session.query(TuningActionAudit.id).filter(TuningActionAudit.user_id != SYSTEM_USER_ID).first()
    )
    has_non_system_calibration = bool(
        session.query(ScoreCalibrationEvent.id).filter(ScoreCalibrationEvent.user_id != SYSTEM_USER_ID).first()
    )
    if not (non_system_count or has_non_system_scan_sessions or has_non_system_tuning_audit or has_non_system_calibration):
        return

    system_settings = session.query(AppSettings).filter(AppSettings.user_id == SYSTEM_USER_ID).order_by(AppSettings.id.asc()).first()
    non_system_settings = (
        session.query(AppSettings)
        .filter(AppSettings.user_id != SYSTEM_USER_ID)
        .order_by(AppSettings.id.asc())
        .all()
    )
    if system_settings is not None:
        for row in non_system_settings:
            session.delete(row)
    elif non_system_settings:
        keep = non_system_settings[0]
        keep.user_id = SYSTEM_USER_ID
        for row in non_system_settings[1:]:
            session.delete(row)

    session.query(ScanSession).filter(ScanSession.user_id != SYSTEM_USER_ID).update(
        {ScanSession.user_id: SYSTEM_USER_ID},
        synchronize_session=False,
    )
    session.query(TuningActionAudit).filter(TuningActionAudit.user_id != SYSTEM_USER_ID).update(
        {TuningActionAudit.user_id: SYSTEM_USER_ID},
        synchronize_session=False,
    )
    session.query(ScoreCalibrationEvent).filter(ScoreCalibrationEvent.user_id != SYSTEM_USER_ID).update(
        {ScoreCalibrationEvent.user_id: SYSTEM_USER_ID},
        synchronize_session=False,
    )
    session.commit()


def ensure_defaults(session: Session) -> None:
    """Deprecated: use provision_new_user(session, user_id) instead."""
    pass


def purge_app_runtime_data(session: Session) -> None:
    try:
        session.execute(text("DELETE FROM tuning_action_audit"))
        session.execute(text("DELETE FROM score_calibration_events"))
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

        session.query(ScoreCalibrationEvent).filter(ScoreCalibrationEvent.generated_at < cutoff).delete(synchronize_session=False)
        session.flush()

        session.query(TuningActionAudit).filter(TuningActionAudit.applied_at < cutoff).delete(synchronize_session=False)
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
    # User-specific provisioning (default settings + presets) now happens on first
    # authenticated API request via provision_new_user(session, user_id).
