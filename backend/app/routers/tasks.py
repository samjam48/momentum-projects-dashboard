from __future__ import annotations

from fastapi import APIRouter, Query, Response, status

from app.db.database import SessionDep
from app.models.task import Task
from app.models.time_log import TimeLog
from app.schemas.task import (
    TaskCreate,
    TaskPriority,
    TaskRead,
    TaskStatus,
    TaskStatusUpdate,
    TaskUpdate,
    TimeLogCreate,
    TimeLogRead,
)
from app.services import tasks as task_services

router = APIRouter(prefix="/tasks")


@router.get("", response_model=list[TaskRead])
def list_tasks(
    session: SessionDep,
    project_id: str | None = None,
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    priority: TaskPriority | None = None,
) -> list[Task]:
    return task_services.list_tasks(session, project_id, status_filter, priority)


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(session: SessionDep, payload: TaskCreate) -> Task:
    return task_services.create_task(session, payload)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(session: SessionDep, task_id: str) -> Task:
    return task_services.get_task(session, task_id)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(session: SessionDep, task_id: str, payload: TaskUpdate) -> Task:
    return task_services.update_task(session, task_id, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(session: SessionDep, task_id: str) -> Response:
    task_services.delete_task(session, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{task_id}/status", response_model=TaskRead)
def update_task_status(
    session: SessionDep,
    task_id: str,
    payload: TaskStatusUpdate,
) -> Task:
    return task_services.update_task_status(session, task_id, payload)


@router.get("/{task_id}/time-logs", response_model=list[TimeLogRead])
def list_time_logs(session: SessionDep, task_id: str) -> list[TimeLog]:
    return task_services.list_time_logs(session, task_id)


@router.post(
    "/{task_id}/time-logs",
    response_model=TimeLogRead,
    status_code=status.HTTP_201_CREATED,
)
def create_time_log(session: SessionDep, task_id: str, payload: TimeLogCreate) -> TimeLog:
    return task_services.create_time_log(session, task_id, payload)
