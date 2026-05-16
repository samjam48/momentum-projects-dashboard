from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    venture_id: str | None = Field(default=None, foreign_key="ventures.id")
    name: str
    description: str | None = None
    colour: str | None = None
    icon: str | None = None
    project_type: str = Field(default="project", nullable=False)
    status: str = Field(default="active", nullable=False)
    board_status: str = Field(default="active", nullable=False)
    kanban_order: int | None = None
    finished: bool = Field(default=False, nullable=False)
    archived_by_venture: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, nullable=False)
