from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import field_validator
from sqlmodel import SQLModel

HEX_COLOUR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")
ProjectStatus = Literal["active", "archived"]
ProjectType = Literal["project", "asset", "gig", "contract"]
ProjectBoardStatus = Literal["idea", "active", "paused", "shipped"]


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
    venture_id: str
    name: str
    description: str | None = None
    colour: str | None = None
    icon: str | None = None
    project_type: ProjectType = "project"
    board_status: ProjectBoardStatus = "active"
    kanban_order: int | None = None
    finished: bool = False
    archived_by_venture: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_name(value)

    @field_validator("colour")
    @classmethod
    def validate_colour(cls, value: str | None) -> str | None:
        return _validate_colour(value)


class ProjectUpdate(SQLModel):
    venture_id: str | None = None
    name: str | None = None
    description: str | None = None
    colour: str | None = None
    icon: str | None = None
    project_type: ProjectType | None = None
    board_status: ProjectBoardStatus | None = None
    kanban_order: int | None = None
    finished: bool | None = None
    archived_by_venture: bool | None = None

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

    @field_validator("venture_id")
    @classmethod
    def validate_venture_id(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("venture_id must not be null")
        return value


class ProjectRead(SQLModel):
    id: str
    venture_id: str | None
    name: str
    description: str | None
    colour: str | None
    icon: str | None
    project_type: ProjectType
    status: ProjectStatus
    board_status: ProjectBoardStatus
    kanban_order: int | None
    finished: bool
    archived_by_venture: bool
    created_at: datetime
    updated_at: datetime
