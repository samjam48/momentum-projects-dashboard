from __future__ import annotations

from fastapi import APIRouter, Query, Response, status

from app.db.database import SessionDep
from app.schemas.activity_type import (
    ActivityTypeCreate,
    ActivityTypeRead,
    ActivityTypeStatus,
    ActivityTypeUpdate,
)
from app.schemas.pagination import PaginatedResponse
from app.services import activity_types

router = APIRouter(prefix="/activity-types")


@router.get("", response_model=list[ActivityTypeRead] | PaginatedResponse[ActivityTypeRead])
def list_activity_types(
    session: SessionDep,
    status_filter: ActivityTypeStatus | None = Query(default=None, alias="status"),
    limit: int | None = Query(default=None, ge=1, le=500),
    cursor: str | None = None,
) -> list[ActivityTypeRead] | PaginatedResponse[ActivityTypeRead]:
    return activity_types.list_activity_types_paginated(
        session,
        status_filter,
        limit=limit,
        cursor=cursor,
    )


@router.post("", response_model=ActivityTypeRead, status_code=status.HTTP_201_CREATED)
def create_activity_type(
    session: SessionDep,
    payload: ActivityTypeCreate,
) -> ActivityTypeRead:
    return activity_types.create_activity_type(session, payload)


@router.patch("/{activity_type_id}", response_model=ActivityTypeRead)
def update_activity_type(
    session: SessionDep,
    activity_type_id: str,
    payload: ActivityTypeUpdate,
) -> ActivityTypeRead:
    return activity_types.update_activity_type(session, activity_type_id, payload)


@router.delete("/{activity_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity_type(session: SessionDep, activity_type_id: str) -> Response:
    activity_types.delete_activity_type(session, activity_type_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{activity_type_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
def archive_activity_type(session: SessionDep, activity_type_id: str) -> Response:
    activity_types.archive_activity_type(session, activity_type_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
