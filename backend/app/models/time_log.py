from __future__ import annotations

from datetime import date, datetime
from uuid import uuid4

from app.core.time import utc_now
from sqlmodel import Field, SQLModel


class TimeLog(SQLModel, table=True):
    __tablename__ = "time_logs"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    task_id: str | None = Field(default=None, foreign_key="tasks.id", nullable=True)
    project_id: str = Field(foreign_key="projects.id", nullable=False)
    status: str = Field(default="active", nullable=False)
    activity_type_id: str | None = Field(default=None, foreign_key="activity_types.id")
    hours: float
    logged_date: date
    source: str = Field(default="manual", nullable=False)
    external_id: str | None = None
    notes: str | None = None
    title: str | None = None
    location: str | None = None
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
