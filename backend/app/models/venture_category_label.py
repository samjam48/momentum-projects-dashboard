from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from app.core.time import utc_now
from sqlmodel import Field, SQLModel


class VentureCategoryLabel(SQLModel, table=True):
    __tablename__ = "venture_category_labels"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    slug: str = Field(nullable=False, unique=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, nullable=False)
