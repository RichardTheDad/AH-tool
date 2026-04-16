"""add vendor_price and expansion to items

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-20 00:00:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("items") as batch_op:
        batch_op.add_column(sa.Column("vendor_price", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("expansion", sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("items") as batch_op:
        batch_op.drop_column("expansion")
        batch_op.drop_column("vendor_price")
