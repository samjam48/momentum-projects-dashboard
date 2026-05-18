from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any, cast

from app.models.activity_type import ActivityType
from app.models.project import Project
from app.models.task import Task
from app.models.time_log import TimeLog
from app.models.venture import Venture
from app.schemas.task import (
    TaskCreate,
    TaskPriority,
    TaskStatus,
    TaskStatusUpdate,
    TaskUpdate,
    TimeLogCreate,
    TimeLogRead,
    TimeLogUpdate,
)
from app.services.task_guards import ensure_project_mutable, ensure_task_mutable
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


def _ensure_parent_chain_allows_archived_leave_kanban(
    session: Session,
    *,
    prior_status: TaskStatus,
    task_project_id: str,
) -> None:
    """Block leaving archived when restoring into Kanban columns with buried parents."""
    if prior_status != "archived":
        return

    project = session.get(Project, task_project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    if project.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived projects cannot accept task changes.",
        )

    venture_id = project.venture_id
    if venture_id is None:
        return
    venture = session.get(Venture, venture_id)
    if venture is None or venture.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot restore archived task while parent venture is archived.",
        )


def _apply_completed_date(status_value: TaskStatus, completed_date: date | None) -> date | None:
    if status_value == "done":
        return completed_date or _utc_today()
    if status_value == "archived":
        return completed_date
    return None


def _active_activity_type_name_or_422(session: Session, activity_type_id: str) -> str:
    activity_type = session.get(ActivityType, activity_type_id)
    if activity_type is None or activity_type.status != "active":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="activity_type_id must reference an active activity type",
        )
    return activity_type.name


def _recompute_actual_hours(session: Session, task: Task) -> None:
    hours_total = session.exec(
        select(func.sum(TimeLog.hours)).where(
            TimeLog.task_id == task.id,
            TimeLog.status == "active",
        )
    ).one()
    task.actual_hours = float(hours_total or 0.0)
    task.updated_at = _utc_now()
    session.add(task)


def _to_time_log_read(
    time_log: TimeLog,
    activity_type_name: str | None = None,
) -> TimeLogRead:
    if time_log.task_id is None:
        raise ValueError("TimeLog.task_id must be present when building TimeLogRead.")
    return TimeLogRead(
        id=time_log.id,
        task_id=time_log.task_id,
        project_id=time_log.project_id,
        activity_type_id=time_log.activity_type_id,
        activity_type_name=activity_type_name,
        activity_type_display_name=activity_type_name or "uncategorised",
        hours=time_log.hours,
        logged_date=time_log.logged_date,
        source=time_log.source,
        external_id=time_log.external_id,
        notes=time_log.notes,
        title=time_log.title,
        location=time_log.location,
        created_at=time_log.created_at,
    )


def _enforce_time_log_project_integrity(*, time_log: TimeLog, task: Task) -> None:
    if time_log.project_id != task.project_id:
        raise ValueError("Time log project_id must match task.project_id after flush.")


def _apply_time_log_update(
    session: Session,
    *,
    time_log: TimeLog,
    update_data: dict[str, Any],
) -> None:
    if "activity_type_id" in update_data:
        new_activity_id = update_data["activity_type_id"]
        if new_activity_id is not None:
            _active_activity_type_name_or_422(session, new_activity_id)
        time_log.activity_type_id = new_activity_id

    for field_name in ("hours", "logged_date"):
        value = update_data.get(field_name)
        if value is not None:
            setattr(time_log, field_name, value)

    for field_name in ("notes", "title", "location"):
        if field_name in update_data:
            setattr(time_log, field_name, update_data[field_name])


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
    ensure_project_mutable(session, payload.project_id)
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
    task = ensure_task_mutable(session, task_id)
    target_project_id = payload.project_id if payload.project_id is not None else task.project_id
    project_id_changed = target_project_id != task.project_id
    if project_id_changed:
        ensure_project_mutable(session, target_project_id)

    update_data = payload.model_dump(exclude_unset=True)
    next_status = cast(TaskStatus, update_data.get("status", task.status))
    for field_name, value in update_data.items():
        setattr(task, field_name, value)
    task.completed_date = _apply_completed_date(next_status, task.completed_date)
    task.updated_at = _utc_now()

    session.add(task)
    if project_id_changed:
        statement = select(TimeLog).where(
            TimeLog.task_id == task.id,
            TimeLog.status == "active",
        )
        for time_log in session.exec(statement):
            time_log.project_id = task.project_id
            session.add(time_log)
    session.commit()
    session.refresh(task)
    return task


def delete_task(session: Session, task_id: str) -> None:
    task = _get_task_or_404(session, task_id)
    statement = select(TimeLog).where(TimeLog.task_id == task.id)
    for time_log in session.exec(statement):
        time_log.status = "archived"
        time_log.task_id = None
        session.add(time_log)
    session.delete(task)
    session.commit()


def update_task_status(session: Session, task_id: str, payload: TaskStatusUpdate) -> Task:
    task = _get_task_or_404(session, task_id)
    previous_status = cast(TaskStatus, task.status)
    previous_completed_date = task.completed_date

    _ensure_parent_chain_allows_archived_leave_kanban(
        session,
        prior_status=previous_status,
        task_project_id=task.project_id,
    )
    task = ensure_task_mutable(session, task_id)

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


def list_time_logs(session: Session, task_id: str) -> list[TimeLogRead]:
    task = _get_task_or_404(session, task_id)
    time_logs = list(
        session.exec(
            select(TimeLog)
            .where(
                TimeLog.task_id == task.id,
                TimeLog.status == "active",
            )
            .order_by(col(TimeLog.logged_date).desc(), col(TimeLog.created_at).desc())
        )
    )
    if not time_logs:
        return []
    activity_type_ids = {
        time_log.activity_type_id for time_log in time_logs if time_log.activity_type_id is not None
    }
    activity_types_by_id: dict[str, str] = {}
    if activity_type_ids:
        activity_types = session.exec(
            select(ActivityType).where(col(ActivityType.id).in_(activity_type_ids))
        ).all()
        activity_types_by_id = {
            activity_type.id: activity_type.name for activity_type in activity_types
        }

    return [
        _to_time_log_read(
            time_log,
            activity_types_by_id.get(time_log.activity_type_id or ""),
        )
        for time_log in time_logs
    ]


def create_time_log(session: Session, task_id: str, payload: TimeLogCreate) -> TimeLogRead:
    task = ensure_task_mutable(session, task_id)
    activity_type_name: str | None = None
    if payload.activity_type_id is not None:
        activity_type_name = _active_activity_type_name_or_422(
            session,
            payload.activity_type_id,
        )
    time_log = TimeLog(
        task_id=task.id,
        project_id=task.project_id,
        status="active",
        activity_type_id=payload.activity_type_id,
        hours=payload.hours,
        logged_date=payload.logged_date,
        notes=payload.notes,
        title=payload.title,
        location=payload.location,
        source="manual",
    )
    session.add(time_log)
    session.flush()
    _enforce_time_log_project_integrity(time_log=time_log, task=task)
    _recompute_actual_hours(session, task)
    session.commit()
    session.refresh(time_log)
    session.refresh(task)
    return _to_time_log_read(time_log, activity_type_name)


def update_time_log(
    session: Session,
    task_id: str,
    time_log_id: str,
    payload: TimeLogUpdate,
) -> TimeLogRead:
    task = ensure_task_mutable(session, task_id)
    time_log = session.get(TimeLog, time_log_id)
    if time_log is None or time_log.task_id != task.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time log not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one field is required.",
        )

    _apply_time_log_update(session, time_log=time_log, update_data=update_data)

    session.add(time_log)
    session.flush()
    _enforce_time_log_project_integrity(time_log=time_log, task=task)
    _recompute_actual_hours(session, task)
    session.commit()
    session.refresh(time_log)
    session.refresh(task)

    read_name: str | None = None
    if time_log.activity_type_id is not None:
        linked = session.get(ActivityType, time_log.activity_type_id)
        read_name = linked.name if linked is not None else None

    return _to_time_log_read(time_log, read_name)


def delete_time_log(session: Session, task_id: str, time_log_id: str) -> None:
    task = _get_task_or_404(session, task_id)
    time_log = session.get(TimeLog, time_log_id)
    if time_log is None or time_log.task_id != task.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time log not found.",
        )

    session.delete(time_log)
    session.flush()
    _recompute_actual_hours(session, task)
    session.commit()
