"""time log status and nullable task_id

Revision ID: 20260518_0005
Revises: 20260515_0004
Create Date: 2026-05-18 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260518_0005"
down_revision = "20260515_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("time_logs") as batch_op:
        batch_op.add_column(
            sa.Column("status", sa.String(), nullable=False, server_default="active")
        )
        batch_op.alter_column(
            "task_id",
            existing_type=sa.String(),
            nullable=True,
        )

    op.execute(sa.text("UPDATE time_logs SET status = 'active' WHERE status IS NULL"))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM time_logs WHERE task_id IS NULL"))
    with op.batch_alter_table("time_logs") as batch_op:
        batch_op.alter_column(
            "task_id",
            existing_type=sa.String(),
            nullable=False,
        )
        batch_op.drop_column("status")
