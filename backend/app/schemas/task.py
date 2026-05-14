from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import field_validator
from sqlmodel import SQLModel

TaskStatus = Literal["backlog", "in_progress", "review", "done"]
TaskPriority = Literal["low", "medium", "high", "urgent"]


def _normalize_title(title: str) -> str:
    stripped_title = title.strip()
    if not stripped_title:
        raise ValueError("title must not be blank")
    return stripped_title


def _validate_estimated_hours(value: float | None) -> float | None:
    if value is None:
        return None
    if value < 0:
        raise ValueError("estimated_hours must be non-negative")
    return value


def _validate_hours(value: float) -> float:
    if value <= 0:
        raise ValueError("hours must be greater than zero")
    return value


class TaskCreate(SQLModel):
    project_id: str
    title: str
    description: str | None = None
    status: TaskStatus = "backlog"
    priority: TaskPriority = "medium"
    estimated_hours: float | None = None
    target_date: date | None = None
    kanban_order: int | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _normalize_title(value)

    @field_validator("estimated_hours")
    @classmethod
    def validate_estimated_hours(cls, value: float | None) -> float | None:
        return _validate_estimated_hours(value)


class TaskUpdate(SQLModel):
    project_id: str | None = None
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    estimated_hours: float | None = None
    target_date: date | None = None
    kanban_order: int | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_title(value)

    @field_validator("estimated_hours")
    @classmethod
    def validate_estimated_hours(cls, value: float | None) -> float | None:
        return _validate_estimated_hours(value)


class TaskStatusUpdate(SQLModel):
    status: TaskStatus
    kanban_order: int | None = None


class TaskRead(SQLModel):
    id: str
    project_id: str
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    estimated_hours: float | None
    actual_hours: float
    target_date: date | None
    completed_date: date | None
    kanban_order: int | None
    created_at: datetime
    updated_at: datetime


class TimeLogCreate(SQLModel):
    hours: float
    logged_date: date
    notes: str | None = None

    @field_validator("hours")
    @classmethod
    def validate_hours(cls, value: float) -> float:
        return _validate_hours(value)


class TimeLogRead(SQLModel):
    id: str
    task_id: str
    project_id: str
    hours: float
    logged_date: date
    source: str
    external_id: str | None
    notes: str | None
    created_at: datetime
