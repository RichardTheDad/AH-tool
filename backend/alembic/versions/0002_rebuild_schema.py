"""rebuild schema to match current models

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-14 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop all tables in reverse dependency order (0001 had wrong schemas)
    op.execute("DROP TABLE IF EXISTS score_calibration_events CASCADE")
    op.execute("DROP TABLE IF EXISTS tuning_action_audits CASCADE")
    op.execute("DROP TABLE IF EXISTS tuning_action_audit CASCADE")
    op.execute("DROP TABLE IF EXISTS realm_suggestion_recommendations CASCADE")
    op.execute("DROP TABLE IF EXISTS realm_suggestion_runs CASCADE")
    op.execute("DROP TABLE IF EXISTS scan_results CASCADE")
    op.execute("DROP TABLE IF EXISTS scan_sessions CASCADE")
    op.execute("DROP TABLE IF EXISTS scan_presets CASCADE")
    op.execute("DROP TABLE IF EXISTS tracked_realms CASCADE")
    op.execute("DROP TABLE IF EXISTS app_settings CASCADE")
    op.execute("DROP TABLE IF EXISTS listing_snapshots CASCADE")
    op.execute("DROP TABLE IF EXISTS items CASCADE")

    # --- items ---
    op.create_table(
        "items",
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("class_name", sa.String(length=120), nullable=True),
        sa.Column("subclass_name", sa.String(length=120), nullable=True),
        sa.Column("quality", sa.String(length=64), nullable=True),
        sa.Column("icon_url", sa.String(length=500), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("metadata_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_commodity", sa.Boolean(), nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("item_id"),
    )
    op.create_index("ix_items_name", "items", ["name"])

    # --- tracked_realms ---
    op.create_table(
        "tracked_realms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("realm_name", sa.String(length=120), nullable=False),
        sa.Column("region", sa.String(length=16), nullable=False, server_default="us"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("user_id", "region", "realm_name", name="ux_tracked_realms_user_region_realm"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tracked_realms_user_id", "tracked_realms", ["user_id"])
    op.create_index("ix_tracked_realms_realm_name", "tracked_realms", ["realm_name"])

    # --- app_settings ---
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("ah_cut_percent", sa.Float(), nullable=False, server_default="0.05"),
        sa.Column("flat_buffer", sa.Float(), nullable=False, server_default="0"),
        sa.Column("refresh_interval_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("stale_after_minutes", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("scoring_preset", sa.String(length=32), nullable=False, server_default="balanced"),
        sa.Column("non_commodity_only", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("user_id", name="ux_app_settings_user"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_app_settings_user_id", "app_settings", ["user_id"])

    # --- scan_presets ---
    op.create_table(
        "scan_presets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("min_profit", sa.Float(), nullable=True),
        sa.Column("min_roi", sa.Float(), nullable=True),
        sa.Column("max_buy_price", sa.Float(), nullable=True),
        sa.Column("min_confidence", sa.Float(), nullable=True),
        sa.Column("allow_stale", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("hide_risky", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("category_filter", sa.String(length=120), nullable=True),
        sa.UniqueConstraint("user_id", "name", name="ux_scan_presets_user_name"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_presets_user_id", "scan_presets", ["user_id"])

    # --- listing_snapshots ---
    op.create_table(
        "listing_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("realm", sa.String(length=120), nullable=False),
        sa.Column("lowest_price", sa.Float(), nullable=True),
        sa.Column("average_price", sa.Float(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("listing_count", sa.Integer(), nullable=True),
        sa.Column("source_name", sa.String(length=64), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_stale", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["item_id"], ["items.item_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("item_id", "realm", "source_name", "captured_at", name="ux_listing_snapshots_exact"),
    )
    op.create_index("ix_listing_snapshots_item_id", "listing_snapshots", ["item_id"])
    op.create_index("ix_listing_snapshots_realm", "listing_snapshots", ["realm"])
    op.create_index("ix_listing_snapshots_captured_at", "listing_snapshots", ["captured_at"])
    op.create_index("ix_listing_snapshots_item_realm_captured", "listing_snapshots", ["item_id", "realm", "captured_at"])
    op.create_index("ix_listing_snapshots_realm_item_captured", "listing_snapshots", ["realm", "item_id", "captured_at"])
    op.create_index("ix_listing_snapshots_source_realm_captured", "listing_snapshots", ["source_name", "realm", "captured_at"])

    # --- scan_sessions ---
    op.create_table(
        "scan_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("provider_name", sa.String(length=64), nullable=False, server_default="stored"),
        sa.Column("warning_text", sa.Text(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_sessions_user_id", "scan_sessions", ["user_id"])
    op.create_index("ix_scan_sessions_generated_at", "scan_sessions", ["generated_at"])

    # --- scan_results ---
    op.create_table(
        "scan_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scan_session_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("cheapest_buy_realm", sa.String(length=120), nullable=False),
        sa.Column("cheapest_buy_price", sa.Float(), nullable=False),
        sa.Column("best_sell_realm", sa.String(length=120), nullable=False),
        sa.Column("best_sell_price", sa.Float(), nullable=False),
        sa.Column("estimated_profit", sa.Float(), nullable=False),
        sa.Column("roi", sa.Float(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("sellability_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("liquidity_score", sa.Float(), nullable=False),
        sa.Column("volatility_score", sa.Float(), nullable=False),
        sa.Column("bait_risk_score", sa.Float(), nullable=False),
        sa.Column("final_score", sa.Float(), nullable=False),
        sa.Column("turnover_label", sa.String(length=24), nullable=False, server_default="slow"),
        sa.Column("score_provenance_json", sa.JSON(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("has_stale_data", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_risky", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["scan_session_id"], ["scan_sessions.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["items.item_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_results_scan_session_id", "scan_results", ["scan_session_id"])
    op.create_index("ix_scan_results_item_id", "scan_results", ["item_id"])

    # --- realm_suggestion_runs ---
    op.create_table(
        "realm_suggestion_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("target_set_key", sa.String(length=255), nullable=True),
        sa.Column("target_realms_json", sa.JSON(), nullable=True),
        sa.Column("source_realms_json", sa.JSON(), nullable=True),
        sa.Column("batch_start", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("batch_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_realm_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warning_text", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_realm_suggestion_runs_user_id", "realm_suggestion_runs", ["user_id"])
    op.create_index("ix_realm_suggestion_runs_generated_at", "realm_suggestion_runs", ["generated_at"])
    op.create_index("ix_realm_suggestion_runs_target_set_key", "realm_suggestion_runs", ["target_set_key"])

    # --- realm_suggestion_recommendations ---
    op.create_table(
        "realm_suggestion_recommendations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("realm", sa.String(length=120), nullable=False),
        sa.Column("opportunity_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cheapest_source_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("average_profit", sa.Float(), nullable=False, server_default="0"),
        sa.Column("average_roi", sa.Float(), nullable=False, server_default="0"),
        sa.Column("average_confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("average_sellability", sa.Float(), nullable=False, server_default="0"),
        sa.Column("consistency_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("median_buy_price", sa.Float(), nullable=True),
        sa.Column("best_target_realm", sa.String(length=120), nullable=True),
        sa.Column("latest_captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=False, server_default=""),
        sa.Column("top_items_json", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["realm_suggestion_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_realm_suggestion_recommendations_run_id", "realm_suggestion_recommendations", ["run_id"])
    op.create_index("ix_realm_suggestion_recommendations_realm", "realm_suggestion_recommendations", ["realm"])

    # --- tuning_action_audit (correct name) ---
    op.create_table(
        "tuning_action_audit",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("action_id", sa.String(length=64), nullable=False),
        sa.Column("action_label", sa.String(length=160), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="scanner_suggestion"),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("previous_settings_json", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tuning_action_audit_user_id", "tuning_action_audit", ["user_id"])
    op.create_index("ix_tuning_action_audit_action_id", "tuning_action_audit", ["action_id"])
    op.create_index("ix_tuning_action_audit_applied", "tuning_action_audit", ["applied_at"])
    op.create_index("ix_tuning_action_audit_action", "tuning_action_audit", ["action_id", "applied_at"])

    # --- score_calibration_events ---
    op.create_table(
        "score_calibration_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("scan_result_id", sa.Integer(), nullable=True),
        sa.Column("scan_session_id", sa.Integer(), nullable=True),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("buy_realm", sa.String(length=120), nullable=False),
        sa.Column("sell_realm", sa.String(length=120), nullable=False),
        sa.Column("predicted_confidence", sa.Float(), nullable=False),
        sa.Column("predicted_sellability", sa.Float(), nullable=False),
        sa.Column("predicted_profit", sa.Float(), nullable=False),
        sa.Column("predicted_buy_price", sa.Float(), nullable=False),
        sa.Column("predicted_sell_price", sa.Float(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("evaluation_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("evaluation_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("horizon_outcomes_json", sa.JSON(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("realized_outcome", sa.Boolean(), nullable=True),
        sa.Column("realized_sell_price", sa.Float(), nullable=True),
        sa.Column("outcome_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["scan_result_id"], ["scan_results.id"]),
        sa.ForeignKeyConstraint(["scan_session_id"], ["scan_sessions.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["items.item_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_score_calibration_events_user_id", "score_calibration_events", ["user_id"])
    op.create_index("ix_score_calibration_events_scan_result_id", "score_calibration_events", ["scan_result_id"])
    op.create_index("ix_score_calibration_events_scan_session_id", "score_calibration_events", ["scan_session_id"])
    op.create_index("ix_score_calibration_events_item_id", "score_calibration_events", ["item_id"])
    op.create_index("ix_score_calibration_events_sell_realm", "score_calibration_events", ["sell_realm"])
    op.create_index("ix_score_calibration_events_generated", "score_calibration_events", ["generated_at"])
    op.create_index("ix_score_calibration_events_due", "score_calibration_events", ["evaluation_due_at", "evaluated_at"])
    op.create_index("ix_score_calibration_events_evaluation_due_at", "score_calibration_events", ["evaluation_due_at"])
    op.create_index("ix_score_calibration_events_evaluation_expires_at", "score_calibration_events", ["evaluation_expires_at"])


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS score_calibration_events CASCADE")
    op.execute("DROP TABLE IF EXISTS tuning_action_audit CASCADE")
    op.execute("DROP TABLE IF EXISTS realm_suggestion_recommendations CASCADE")
    op.execute("DROP TABLE IF EXISTS realm_suggestion_runs CASCADE")
    op.execute("DROP TABLE IF EXISTS scan_results CASCADE")
    op.execute("DROP TABLE IF EXISTS scan_sessions CASCADE")
    op.execute("DROP TABLE IF EXISTS scan_presets CASCADE")
    op.execute("DROP TABLE IF EXISTS tracked_realms CASCADE")
    op.execute("DROP TABLE IF EXISTS app_settings CASCADE")
    op.execute("DROP TABLE IF EXISTS listing_snapshots CASCADE")
    op.execute("DROP TABLE IF EXISTS items CASCADE")
