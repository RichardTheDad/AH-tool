"""make tracked realms unique per region

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-16 00:00:00.000000

"""
from __future__ import annotations

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL so the migration is idempotent on fresh databases where
    # migration 0002 already creates the new constraint and never creates the
    # old one.
    op.execute(
        'ALTER TABLE tracked_realms DROP CONSTRAINT IF EXISTS "ux_tracked_realms_user_realm"'
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ux_tracked_realms_user_region_realm'
            ) THEN
                ALTER TABLE tracked_realms
                ADD CONSTRAINT ux_tracked_realms_user_region_realm
                UNIQUE (user_id, region, realm_name);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("tracked_realms") as batch_op:
        batch_op.drop_constraint("ux_tracked_realms_user_region_realm", type_="unique")
        batch_op.create_unique_constraint(
            "ux_tracked_realms_user_realm",
            ["user_id", "realm_name"],
        )
