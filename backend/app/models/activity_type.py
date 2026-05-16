from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class ActivityType(SQLModel, table=True):
    __tablename__ = "activity_types"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    slug: str = Field(nullable=False, unique=True)
    status: str = Field(default="active", nullable=False)
    sort_order: int | None = None
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, nullable=False)
