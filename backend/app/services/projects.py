from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

from app.models.project import Project
from app.models.venture import Venture
from app.schemas.project import ProjectCreate, ProjectStatus, ProjectUpdate
from fastapi import HTTPException, status
from sqlmodel import Session, select


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _get_project_or_404(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    return project


def _get_active_venture_or_404(session: Session, venture_id: str) -> Venture:
    venture = session.get(Venture, venture_id)
    if venture is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venture not found.",
        )
    if venture.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived ventures cannot own active projects.",
        )
    return venture


def list_projects(session: Session, project_status: ProjectStatus | None) -> list[Project]:
    status_filter = project_status or "active"
    statement = (
        select(Project)
        .where(Project.status == status_filter)
        .order_by(cast(Any, Project.created_at))
    )
    return list(session.exec(statement))


def create_project(session: Session, payload: ProjectCreate) -> Project:
    _get_active_venture_or_404(session, payload.venture_id)
    project = Project(
        venture_id=payload.venture_id,
        name=payload.name,
        description=payload.description,
        colour=payload.colour,
        icon=payload.icon,
        project_type=payload.project_type,
        board_status=payload.board_status,
        kanban_order=payload.kanban_order,
        finished=payload.finished,
        archived_by_venture=payload.archived_by_venture,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def get_project(session: Session, project_id: str) -> Project:
    return _get_project_or_404(session, project_id)


def update_project(session: Session, project_id: str, payload: ProjectUpdate) -> Project:
    project = _get_project_or_404(session, project_id)
    if project.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived projects are read-only.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    venture_id = update_data.get("venture_id")
    if isinstance(venture_id, str):
        _get_active_venture_or_404(session, venture_id)
    for field_name, value in update_data.items():
        setattr(project, field_name, value)
    project.updated_at = _utc_now()

    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def archive_project(session: Session, project_id: str) -> None:
    project = _get_project_or_404(session, project_id)
    if project.status != "archived":
        project.status = "archived"
        project.updated_at = _utc_now()
        session.add(project)
        session.commit()
