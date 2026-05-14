from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import field_validator
from sqlmodel import SQLModel

HEX_COLOUR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")
ProjectStatus = Literal["active", "archived"]


def _normalize_name(name: str) -> str:
    stripped_name = name.strip()
    if not stripped_name:
        raise ValueError("name must not be blank")
    return stripped_name


def _validate_colour(colour: str | None) -> str | None:
    if colour is None:
        return None
    if not HEX_COLOUR_PATTERN.match(colour):
        raise ValueError("colour must match #RRGGBB")
    return colour


class ProjectCreate(SQLModel):
    name: str
    description: str | None = None
    colour: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_name(value)

    @field_validator("colour")
    @classmethod
    def validate_colour(cls, value: str | None) -> str | None:
        return _validate_colour(value)


class ProjectUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    colour: str | None = None

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


class ProjectRead(SQLModel):
    id: str
    name: str
    description: str | None
    colour: str | None
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
