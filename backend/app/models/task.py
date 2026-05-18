from __future__ import annotations

from datetime import date, datetime
from uuid import uuid4

from app.core.time import utc_now
from sqlmodel import Field, SQLModel


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", nullable=False)
    title: str
    description: str | None = None
    status: str = Field(default="backlog", nullable=False)
    priority: str = Field(default="medium", nullable=False)
    estimated_hours: float | None = None
    actual_hours: float = Field(default=0.0, nullable=False)
    target_date: date | None = None
    completed_date: date | None = None
    kanban_order: int | None = None
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, nullable=False)
