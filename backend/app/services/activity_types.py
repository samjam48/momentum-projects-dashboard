from __future__ import annotations

import re
from datetime import UTC, datetime

from app.models.activity_type import ActivityType
from app.models.time_log import TimeLog
from app.schemas.activity_type import (
    ActivityTypeCreate,
    ActivityTypeRead,
    ActivityTypeStatus,
    ActivityTypeUpdate,
)
from fastapi import HTTPException, status
from sqlmodel import Session, col, select

_SLUG_NON_ALNUM_PATTERN = re.compile(r"[^a-z0-9]+")
_RESERVED_UNCATEGORISED = "uncategorised"


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _slugify(name: str) -> str:
    normalized = _SLUG_NON_ALNUM_PATTERN.sub("-", name.strip().lower()).strip("-")
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="name must contain letters or numbers",
        )
    return normalized


def _to_title_case(name: str) -> str:
    return " ".join(part.capitalize() for part in name.split())


def _get_activity_type_or_404(session: Session, activity_type_id: str) -> ActivityType:
    activity_type = session.get(ActivityType, activity_type_id)
    if activity_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity type not found.",
        )
    return activity_type


def _ensure_slug_unique(
    session: Session,
    slug: str,
    current_activity_type_id: str | None = None,
) -> None:
    existing = session.exec(
        select(ActivityType).where(col(ActivityType.slug) == slug)
    ).first()
    if existing is None:
        return
    if current_activity_type_id is not None and existing.id == current_activity_type_id:
        return
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="name already exists",
    )


def _to_read(activity_type: ActivityType) -> ActivityTypeRead:
    return ActivityTypeRead(
        id=activity_type.id,
        name=activity_type.name,
        slug=activity_type.slug,
        status=activity_type.status,
        sort_order=activity_type.sort_order,
        created_at=activity_type.created_at,
        updated_at=activity_type.updated_at,
    )


def list_activity_types(
    session: Session,
    status_filter: ActivityTypeStatus | None,
) -> list[ActivityTypeRead]:
    active_filter = status_filter or "active"
    rows = list(
        session.exec(
            select(ActivityType)
            .where(ActivityType.status == active_filter)
            .order_by(col(ActivityType.sort_order).nulls_last(), col(ActivityType.created_at))
        )
    )
    return [_to_read(row) for row in rows]


def create_activity_type(session: Session, payload: ActivityTypeCreate) -> ActivityTypeRead:
    slug = _slugify(payload.name)
    if slug == _RESERVED_UNCATEGORISED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="uncategorised is reserved",
        )
    _ensure_slug_unique(session, slug)

    activity_type = ActivityType(
        name=_to_title_case(payload.name.strip()),
        slug=slug,
        status="active",
    )
    session.add(activity_type)
    session.commit()
    session.refresh(activity_type)
    return _to_read(activity_type)


def update_activity_type(
    session: Session,
    activity_type_id: str,
    payload: ActivityTypeUpdate,
) -> ActivityTypeRead:
    activity_type = _get_activity_type_or_404(session, activity_type_id)
    slug = _slugify(payload.name)
    if slug == _RESERVED_UNCATEGORISED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="uncategorised is reserved",
        )
    _ensure_slug_unique(session, slug, current_activity_type_id=activity_type.id)

    activity_type.name = _to_title_case(payload.name.strip())
    activity_type.slug = slug
    activity_type.updated_at = _utc_now()
    session.add(activity_type)
    session.commit()
    session.refresh(activity_type)
    return _to_read(activity_type)


def delete_activity_type(session: Session, activity_type_id: str) -> None:
    activity_type = _get_activity_type_or_404(session, activity_type_id)
    used = session.exec(
        select(TimeLog.id).where(TimeLog.activity_type_id == activity_type.id).limit(1)
    ).first()
    if used is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Activity type is used by time logs.",
        )
    session.delete(activity_type)
    session.commit()


def archive_activity_type(session: Session, activity_type_id: str) -> None:
    activity_type = _get_activity_type_or_404(session, activity_type_id)
    if activity_type.status != "archived":
        activity_type.status = "archived"
        activity_type.updated_at = _utc_now()
        session.add(activity_type)
    time_logs = list(
        session.exec(select(TimeLog).where(TimeLog.activity_type_id == activity_type.id))
    )
    for time_log in time_logs:
        time_log.activity_type_id = None
        session.add(time_log)
    session.commit()
