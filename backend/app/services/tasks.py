from __future__ import annotations

from datetime import UTC, date, datetime
from typing import cast

from app.models.project import Project
from app.models.task import Task
from app.models.time_log import TimeLog
from app.schemas.task import (
    TaskCreate,
    TaskPriority,
    TaskStatus,
    TaskStatusUpdate,
    TaskUpdate,
    TimeLogCreate,
)
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, col, select


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _utc_today() -> date:
    return _utc_now().date()


def _get_task_or_404(session: Session, task_id: str) -> Task:
    task = session.get(Task, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )
    return task


def _get_project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    return project


def _ensure_task_project_is_active(session: Session, project_id: str) -> Project:
    project = _get_project_or_404(session, project_id)
    if project.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived projects cannot accept task changes.",
        )
    return project


def _apply_completed_date(status_value: TaskStatus, completed_date: date | None) -> date | None:
    if status_value == "done":
        return completed_date or _utc_today()
    if status_value == "archived":
        return completed_date
    return None


def _recompute_actual_hours(session: Session, task: Task) -> None:
    hours_total = session.exec(
        select(func.sum(TimeLog.hours)).where(TimeLog.task_id == task.id)
    ).one()
    task.actual_hours = float(hours_total or 0.0)
    task.updated_at = _utc_now()
    session.add(task)


def list_tasks(
    session: Session,
    project_id: str | None,
    task_status: TaskStatus | None,
    priority: TaskPriority | None,
) -> list[Task]:
    statement = select(Task)
    if project_id is not None:
        statement = statement.where(Task.project_id == project_id)
    if task_status is not None:
        statement = statement.where(Task.status == task_status)
    else:
        statement = statement.where(Task.status != "archived")
    if priority is not None:
        statement = statement.where(Task.priority == priority)

    statement = statement.order_by(col(Task.created_at))
    return list(session.exec(statement))


def create_task(session: Session, payload: TaskCreate) -> Task:
    _ensure_task_project_is_active(session, payload.project_id)
    task = Task(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        estimated_hours=payload.estimated_hours,
        target_date=payload.target_date,
        completed_date=_apply_completed_date(payload.status, None),
        kanban_order=payload.kanban_order,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def get_task(session: Session, task_id: str) -> Task:
    return _get_task_or_404(session, task_id)


def update_task(session: Session, task_id: str, payload: TaskUpdate) -> Task:
    task = _get_task_or_404(session, task_id)
    target_project_id = payload.project_id or task.project_id
    _ensure_task_project_is_active(session, target_project_id)

    update_data = payload.model_dump(exclude_unset=True)
    next_status = cast(TaskStatus, update_data.get("status", task.status))
    for field_name, value in update_data.items():
        setattr(task, field_name, value)
    task.completed_date = _apply_completed_date(next_status, task.completed_date)
    task.updated_at = _utc_now()

    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def delete_task(session: Session, task_id: str) -> None:
    task = _get_task_or_404(session, task_id)
    statement = select(TimeLog).where(TimeLog.task_id == task.id)
    for time_log in session.exec(statement):
        session.delete(time_log)
    session.delete(task)
    session.commit()


def update_task_status(session: Session, task_id: str, payload: TaskStatusUpdate) -> Task:
    task = _get_task_or_404(session, task_id)
    previous_status = cast(TaskStatus, task.status)
    previous_completed_date = task.completed_date

    task.status = payload.status
    task.kanban_order = payload.kanban_order
    if payload.status == previous_status == "done":
        task.completed_date = previous_completed_date
    else:
        task.completed_date = _apply_completed_date(payload.status, previous_completed_date)
    task.updated_at = _utc_now()

    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def list_time_logs(session: Session, task_id: str) -> list[TimeLog]:
    task = _get_task_or_404(session, task_id)
    statement = (
        select(TimeLog)
        .where(TimeLog.task_id == task.id)
        .order_by(col(TimeLog.logged_date).desc(), col(TimeLog.created_at).desc())
    )
    return list(session.exec(statement))


def create_time_log(session: Session, task_id: str, payload: TimeLogCreate) -> TimeLog:
    task = _get_task_or_404(session, task_id)
    time_log = TimeLog(
        task_id=task.id,
        project_id=task.project_id,
        hours=payload.hours,
        logged_date=payload.logged_date,
        notes=payload.notes,
        title=payload.title,
        location=payload.location,
        source="manual",
    )
    session.add(time_log)
    session.flush()
    _recompute_actual_hours(session, task)
    session.commit()
    session.refresh(time_log)
    session.refresh(task)
    return time_log
