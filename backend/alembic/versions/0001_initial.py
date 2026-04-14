"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("quality", sa.String(length=32), nullable=True),
        sa.Column("item_class", sa.String(length=64), nullable=True),
        sa.Column("item_subclass", sa.String(length=64), nullable=True),
        sa.Column("vendor_buy_price", sa.Integer(), nullable=True),
        sa.Column("vendor_sell_price", sa.Integer(), nullable=True),
        sa.Column("is_equippable", sa.Boolean(), nullable=True),
        sa.Column("is_stackable", sa.Boolean(), nullable=True),
        sa.Column("purchase_quantity", sa.Integer(), nullable=True),
        sa.Column("icon_url", sa.String(length=512), nullable=True),
        sa.Column("metadata_fetched_at", sa.DateTime(), nullable=True),
        sa.Column("metadata_missing", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_items_name", "items", ["name"])

    op.create_table(
        "listing_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("realm_name", sa.String(length=128), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.BigInteger(), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("snapshot_time", sa.DateTime(), nullable=False),
        sa.Column("is_stale", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_listing_snapshots_item_id", "listing_snapshots", ["item_id"])
    op.create_index("ix_listing_snapshots_realm_name", "listing_snapshots", ["realm_name"])
    op.create_index("ix_listing_snapshots_snapshot_time", "listing_snapshots", ["snapshot_time"])

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("min_profit_gold", sa.Integer(), nullable=False),
        sa.Column("min_roi_pct", sa.Float(), nullable=False),
        sa.Column("tsm_region_fallback_weight", sa.Float(), nullable=False),
        sa.Column("undermine_weight", sa.Float(), nullable=False),
        sa.Column("sale_rate_weight", sa.Float(), nullable=False),
        sa.Column("scan_age_limit_hours", sa.Integer(), nullable=False),
        sa.Column("refresh_interval_minutes", sa.Integer(), nullable=False),
        sa.Column("snapshot_retention_days", sa.Integer(), nullable=False),
        sa.Column("score_tuning_preset", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_app_settings_user_id"),
    )
    op.create_index("ix_app_settings_user_id", "app_settings", ["user_id"])

    op.create_table(
        "scan_presets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("min_profit_gold", sa.Integer(), nullable=True),
        sa.Column("min_roi_pct", sa.Float(), nullable=True),
        sa.Column("tsm_region_fallback_weight", sa.Float(), nullable=True),
        sa.Column("undermine_weight", sa.Float(), nullable=True),
        sa.Column("sale_rate_weight", sa.Float(), nullable=True),
        sa.Column("scan_age_limit_hours", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_scan_presets_user_name"),
    )
    op.create_index("ix_scan_presets_user_id", "scan_presets", ["user_id"])

    op.create_table(
        "tracked_realms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("realm_name", sa.String(length=128), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "realm_name", name="uq_tracked_realms_user_realm"),
    )
    op.create_index("ix_tracked_realms_user_id", "tracked_realms", ["user_id"])

    op.create_table(
        "scan_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("provider_name", sa.String(length=64), nullable=True),
        sa.Column("realm_names", sa.Text(), nullable=True),
        sa.Column("result_count", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_sessions_user_id", "scan_sessions", ["user_id"])
    op.create_index("ix_scan_sessions_started_at", "scan_sessions", ["started_at"])

    op.create_table(
        "scan_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scan_session_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("item_name", sa.String(length=255), nullable=True),
        sa.Column("source_realm", sa.String(length=128), nullable=False),
        sa.Column("target_realm", sa.String(length=128), nullable=False),
        sa.Column("buy_price", sa.BigInteger(), nullable=False),
        sa.Column("sell_price", sa.BigInteger(), nullable=True),
        sa.Column("quantity_available", sa.Integer(), nullable=False),
        sa.Column("profit_gold", sa.Float(), nullable=True),
        sa.Column("roi_pct", sa.Float(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("is_winner", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["scan_session_id"], ["scan_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scan_results_scan_session_id", "scan_results", ["scan_session_id"])
    op.create_index("ix_scan_results_item_id", "scan_results", ["item_id"])

    op.create_table(
        "realm_suggestion_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("run_at", sa.DateTime(), nullable=False),
        sa.Column("target_realm_set_hash", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_realm_suggestion_runs_user_id", "realm_suggestion_runs", ["user_id"])

    op.create_table(
        "realm_suggestion_recommendations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("source_realm", sa.String(length=128), nullable=False),
        sa.Column("target_realm", sa.String(length=128), nullable=False),
        sa.Column("opportunity_count", sa.Integer(), nullable=False),
        sa.Column("avg_roi_pct", sa.Float(), nullable=True),
        sa.Column("avg_profit_gold", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["realm_suggestion_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_realm_suggestion_recommendations_run_id", "realm_suggestion_recommendations", ["run_id"])

    op.create_table(
        "tuning_action_audits",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("field_name", sa.String(length=64), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("performed_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tuning_action_audits_user_id", "tuning_action_audits", ["user_id"])

    op.create_table(
        "score_calibration_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("scan_session_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("source_realm", sa.String(length=128), nullable=False),
        sa.Column("predicted_score", sa.Float(), nullable=True),
        sa.Column("predicted_winner", sa.Boolean(), nullable=True),
        sa.Column("actual_sold", sa.Boolean(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_score_calibration_events_user_id", "score_calibration_events", ["user_id"])
    op.create_index("ix_score_calibration_events_scan_session_id", "score_calibration_events", ["scan_session_id"])


def downgrade() -> None:
    op.drop_table("score_calibration_events")
    op.drop_table("tuning_action_audits")
    op.drop_table("realm_suggestion_recommendations")
    op.drop_table("realm_suggestion_runs")
    op.drop_table("scan_results")
    op.drop_table("scan_sessions")
    op.drop_table("tracked_realms")
    op.drop_table("scan_presets")
    op.drop_table("app_settings")
    op.drop_table("listing_snapshots")
    op.drop_table("items")
