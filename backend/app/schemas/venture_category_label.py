from __future__ import annotations

from datetime import datetime

from pydantic import field_validator
from sqlmodel import SQLModel


def _normalize_label_name(name: str) -> str:
    trimmed = name.strip()
    if not trimmed:
        raise ValueError("name must not be blank")
    return trimmed


class VentureCategoryLabelCreate(SQLModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_label_name(value)


class VentureCategoryLabelUpdate(SQLModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_label_name(value)


class VentureCategoryLabelRead(SQLModel):
    id: str
    name: str
    slug: str
    created_at: datetime
    updated_at: datetime
    usage_count: int
