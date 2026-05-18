from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.core.time import utc_now
from sqlmodel import Field, SQLModel


class Venture(SQLModel, table=True):
    __tablename__ = "ventures"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    description: str | None = None
    colour: str | None = None
    category_label_id: str = Field(foreign_key="venture_category_labels.id", nullable=False)
    icon: str | None = None
    status: str = Field(default="active", nullable=False)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, nullable=False)
