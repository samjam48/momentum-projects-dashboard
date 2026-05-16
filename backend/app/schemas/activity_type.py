from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import field_validator
from sqlmodel import SQLModel

ActivityTypeStatus = Literal["active", "archived"]


def _normalize_name(name: str) -> str:
    trimmed = name.strip()
    if not trimmed:
        raise ValueError("name must not be blank")
    if len(trimmed) > 25:
        raise ValueError("name must be at most 25 characters")
    return trimmed


class ActivityTypeCreate(SQLModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_name(value)


class ActivityTypeUpdate(SQLModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_name(value)


class ActivityTypeRead(SQLModel):
    id: str
    name: str
    slug: str
    status: ActivityTypeStatus
    sort_order: int | None
    created_at: datetime
    updated_at: datetime
