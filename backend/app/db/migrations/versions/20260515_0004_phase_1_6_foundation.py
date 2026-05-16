"""phase 1.6 foundation tables and columns

Revision ID: 20260515_0004
Revises: 20260514_0003
Create Date: 2026-05-15 00:00:00
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "20260515_0004"
down_revision = "20260514_0003"
branch_labels = None
depends_on = None

_VENTURE_LABELS: tuple[str, ...] = (
    "Hustle",
    "Business",
    "Investment",
    "Property",
    "Education",
    "Hobby",
)
_ACTIVITY_TYPES: tuple[str, ...] = ("planning", "meeting", "admin")


def _utc_now() -> datetime:
    return datetime.now(UTC)


def upgrade() -> None:
    op.create_table(
        "venture_category_labels",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "ventures",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("colour", sa.String(), nullable=True),
        sa.Column(
            "category_label_id",
            sa.String(),
            sa.ForeignKey("venture_category_labels.id"),
            nullable=False,
        ),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "activity_types",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False, unique=True),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    with op.batch_alter_table("projects") as batch_op:
        batch_op.add_column(sa.Column("venture_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("icon", sa.String(), nullable=True))
        batch_op.add_column(
            sa.Column("project_type", sa.String(), nullable=False, server_default="project")
        )
        batch_op.add_column(
            sa.Column("board_status", sa.String(), nullable=False, server_default="active")
        )
        batch_op.add_column(sa.Column("kanban_order", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("finished", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(
            sa.Column(
                "archived_by_venture",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.create_foreign_key(
            "fk_projects_venture_id_ventures",
            "ventures",
            ["venture_id"],
            ["id"],
        )

    with op.batch_alter_table("time_logs") as batch_op:
        batch_op.add_column(sa.Column("activity_type_id", sa.String(), nullable=True))
        batch_op.create_foreign_key(
            "fk_time_logs_activity_type_id_activity_types",
            "activity_types",
            ["activity_type_id"],
            ["id"],
        )

    bind = op.get_bind()
    now = _utc_now()

    label_rows: list[dict[str, object]] = []
    label_ids_by_slug: dict[str, str] = {}
    for label_name in _VENTURE_LABELS:
        slug = label_name.lower()
        label_id = str(uuid4())
        label_ids_by_slug[slug] = label_id
        label_rows.append(
            {
                "id": label_id,
                "name": label_name,
                "slug": slug,
                "created_at": now,
                "updated_at": now,
            }
        )

    op.bulk_insert(
        sa.table(
            "venture_category_labels",
            sa.column("id", sa.String()),
            sa.column("name", sa.String()),
            sa.column("slug", sa.String()),
            sa.column("created_at", sa.DateTime(timezone=True)),
            sa.column("updated_at", sa.DateTime(timezone=True)),
        ),
        label_rows,
    )

    unsorted_venture_id = str(uuid4())
    hustle_label_id = label_ids_by_slug["hustle"]
    op.bulk_insert(
        sa.table(
            "ventures",
            sa.column("id", sa.String()),
            sa.column("name", sa.String()),
            sa.column("description", sa.String()),
            sa.column("colour", sa.String()),
            sa.column("category_label_id", sa.String()),
            sa.column("icon", sa.String()),
            sa.column("status", sa.String()),
            sa.column("created_at", sa.DateTime(timezone=True)),
            sa.column("updated_at", sa.DateTime(timezone=True)),
        ),
        [
            {
                "id": unsorted_venture_id,
                "name": "Unsorted",
                "description": None,
                "colour": None,
                "category_label_id": hustle_label_id,
                "icon": None,
                "status": "active",
                "created_at": now,
                "updated_at": now,
            }
        ],
    )

    activity_rows: list[dict[str, object]] = []
    for index, activity_name in enumerate(_ACTIVITY_TYPES):
        activity_rows.append(
            {
                "id": str(uuid4()),
                "name": activity_name,
                "slug": activity_name,
                "status": "active",
                "sort_order": index,
                "created_at": now,
                "updated_at": now,
            }
        )

    op.bulk_insert(
        sa.table(
            "activity_types",
            sa.column("id", sa.String()),
            sa.column("name", sa.String()),
            sa.column("slug", sa.String()),
            sa.column("status", sa.String()),
            sa.column("sort_order", sa.Integer()),
            sa.column("created_at", sa.DateTime(timezone=True)),
            sa.column("updated_at", sa.DateTime(timezone=True)),
        ),
        activity_rows,
    )

    inspector = sa.inspect(bind)
    project_columns = {column["name"] for column in inspector.get_columns("projects")}
    if "is_asset" in project_columns:
        bind.execute(
            sa.text(
                "UPDATE projects SET project_type = 'asset' WHERE is_asset = 1"
            )
        )

    bind.execute(
        sa.text("UPDATE projects SET venture_id = :venture_id"),
        {"venture_id": unsorted_venture_id},
    )


def downgrade() -> None:
    with op.batch_alter_table("time_logs") as batch_op:
        batch_op.drop_constraint(
            "fk_time_logs_activity_type_id_activity_types",
            type_="foreignkey",
        )
        batch_op.drop_column("activity_type_id")

    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_constraint("fk_projects_venture_id_ventures", type_="foreignkey")
        batch_op.drop_column("archived_by_venture")
        batch_op.drop_column("finished")
        batch_op.drop_column("kanban_order")
        batch_op.drop_column("board_status")
        batch_op.drop_column("project_type")
        batch_op.drop_column("icon")
        batch_op.drop_column("venture_id")

    op.drop_table("activity_types")
    op.drop_table("ventures")
    op.drop_table("venture_category_labels")
