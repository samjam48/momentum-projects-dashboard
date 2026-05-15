"""add title and location columns to time_logs

Revision ID: 20260514_0003
Revises: 20260513_0002
Create Date: 2026-05-14 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260514_0003"
down_revision = "20260513_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("time_logs", sa.Column("title", sa.String(), nullable=True))
    op.add_column("time_logs", sa.Column("location", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("time_logs", "location")
    op.drop_column("time_logs", "title")
