from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import field_validator
from sqlmodel import SQLModel

VentureStatus = Literal["active", "archived"]
_ALLOWED_COLOURS: set[str] = {
    "#D97048",
    "#E07A5F",
    "#C8553D",
    "#9C5D35",
    "#B8860B",
    "#6B8E6B",
    "#5B7C99",
    "#7B5EA7",
    "#C77DFF",
    "#E8A87C",
    "#85C1E2",
    "#8B7355",
}


def _normalize_name(name: str) -> str:
    trimmed = name.strip()
    if not trimmed:
        raise ValueError("name must not be blank")
    return trimmed


def _validate_colour(colour: str | None) -> str | None:
    if colour is None:
        return None
    if colour not in _ALLOWED_COLOURS:
        raise ValueError("colour must be one of the approved palette values")
    return colour


class VentureCategoryLabelSummary(SQLModel):
    id: str
    name: str
    slug: str


class VentureCreate(SQLModel):
    name: str
    description: str | None = None
    colour: str | None = None
    category_label_id: str | None = None
    icon: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_name(value)

    @field_validator("colour")
    @classmethod
    def validate_colour(cls, value: str | None) -> str | None:
        return _validate_colour(value)


class VentureUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    colour: str | None = None
    category_label_id: str | None = None
    icon: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_name(value)

    @field_validator("colour")
    @classmethod
    def validate_colour(cls, value: str | None) -> str | None:
        return _validate_colour(value)


class VentureRead(SQLModel):
    id: str
    name: str
    description: str | None
    colour: str | None
    category_label_id: str
    category_label: VentureCategoryLabelSummary
    icon: str | None
    status: VentureStatus
    created_at: datetime
    updated_at: datetime
