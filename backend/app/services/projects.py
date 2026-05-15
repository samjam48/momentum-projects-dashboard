from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

from app.models.project import Project
from app.models.venture import Venture
from app.schemas.project import (
    ProjectBoardStatus,
    ProjectBoardStatusUpdate,
    ProjectCreate,
    ProjectStatus,
    ProjectType,
    ProjectUpdate,
)
from fastapi import HTTPException, status
from sqlalchemy import case
from sqlmodel import Session, col, select


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


def list_projects(
    session: Session,
    project_status: ProjectStatus | None,
    venture_id: str | None = None,
    board_status: ProjectBoardStatus | None = None,
    project_type: ProjectType | None = None,
    finished: bool | None = None,
) -> list[Project]:
    status_filter = project_status or "active"
    statement = select(Project).where(Project.status == status_filter)
    if venture_id is not None:
        statement = statement.where(Project.venture_id == venture_id)
    if board_status is not None:
        statement = statement.where(Project.board_status == board_status)
    if project_type is not None:
        statement = statement.where(Project.project_type == project_type)
    if finished is not None:
        statement = statement.where(Project.finished == finished)
    board_rank = case(
        (col(Project.board_status) == "idea", 0),
        (col(Project.board_status) == "active", 1),
        (col(Project.board_status) == "paused", 2),
        (col(Project.board_status) == "shipped", 3),
        else_=99,
    )
    statement = statement.order_by(
        board_rank,
        col(Project.kanban_order).nulls_last(),
        cast(Any, Project.created_at),
        cast(Any, Project.id),
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
        archived_by_venture=False,
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


def archive_project(session: Session, project_id: str, finished: bool | None = None) -> None:
    project = _get_project_or_404(session, project_id)
    if project.status != "archived":
        project.status = "archived"
        if finished is None:
            project.finished = project.board_status == "shipped"
        else:
            project.finished = finished
        project.archived_by_venture = False
        project.updated_at = _utc_now()
        session.add(project)
        session.commit()


def unarchive_project(session: Session, project_id: str) -> Project:
    project = _get_project_or_404(session, project_id)
    venture = session.get(Venture, project.venture_id) if project.venture_id is not None else None
    if venture is None or venture.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot unarchive project under archived venture.",
        )
    if project.status == "archived":
        project.status = "active"
        project.archived_by_venture = False
        project.updated_at = _utc_now()
        session.add(project)
        session.commit()
        session.refresh(project)
    return project


def update_project_board_status(
    session: Session,
    project_id: str,
    payload: ProjectBoardStatusUpdate,
) -> Project:
    project = _get_project_or_404(session, project_id)
    if project.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived projects cannot move on the board.",
        )
    venture = session.get(Venture, project.venture_id) if project.venture_id is not None else None
    if venture is None or venture.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Projects under archived ventures cannot move on the board.",
        )

    order_projects: list[Project] = []
    if payload.order is not None:
        if len(payload.order) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="order must include at least one project",
            )
        order_ids = [item.project_id for item in payload.order]
        if len(order_ids) != len(set(order_ids)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="order contains duplicate project_id",
            )
        for order_item in payload.order:
            order_project = session.get(Project, order_item.project_id)
            if order_project is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="order contains unknown project_id",
                )
            if order_project.status == "archived":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Archived projects cannot be reordered.",
                )
            if order_project.venture_id != project.venture_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="order contains project outside reorder scope",
                )
            if order_project.board_status != payload.board_status:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="order contains project outside target board column",
                )
            order_projects.append(order_project)

    project.board_status = payload.board_status
    if payload.kanban_order is not None:
        project.kanban_order = payload.kanban_order
    if payload.board_status == "shipped" and payload.finished is None:
        project.finished = True
    elif payload.finished is not None:
        project.finished = payload.finished
    project.updated_at = _utc_now()
    session.add(project)

    if payload.order is not None:
        for order_item, order_project in zip(payload.order, order_projects, strict=True):
            order_project.kanban_order = order_item.kanban_order
            order_project.updated_at = _utc_now()
            session.add(order_project)

    session.commit()
    session.refresh(project)
    return project
