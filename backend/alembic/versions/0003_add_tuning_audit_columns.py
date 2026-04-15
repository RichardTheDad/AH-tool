"""add missing columns to tuning_action_audit

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-14 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tuning_action_audit", sa.Column("resulting_settings_json", sa.JSON(), nullable=True))
    op.add_column("tuning_action_audit", sa.Column("blocked", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("tuning_action_audit", sa.Column("blocked_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tuning_action_audit", "blocked_reason")
    op.drop_column("tuning_action_audit", "blocked")
    op.drop_column("tuning_action_audit", "resulting_settings_json")
