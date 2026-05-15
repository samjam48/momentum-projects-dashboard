from __future__ import annotations

from fastapi import APIRouter, Query, Response, status

from app.db.database import SessionDep
from app.schemas.project import (
    ProjectArchive,
    ProjectBoardStatus,
    ProjectCreate,
    ProjectRead,
    ProjectStatus,
    ProjectType,
    ProjectUpdate,
)
from app.services import projects as project_services

router = APIRouter(prefix="/projects")


@router.get("", response_model=list[ProjectRead])
def list_projects(
    session: SessionDep,
    status_filter: ProjectStatus | None = Query(default=None, alias="status"),
    venture_id: str | None = None,
    board_status: ProjectBoardStatus | None = None,
    project_type: ProjectType | None = None,
    finished: bool | None = None,
) -> list[ProjectRead]:
    projects = project_services.list_projects(
        session,
        status_filter,
        venture_id=venture_id,
        board_status=board_status,
        project_type=project_type,
        finished=finished,
    )
    return [ProjectRead.model_validate(project) for project in projects]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(session: SessionDep, payload: ProjectCreate) -> ProjectRead:
    project = project_services.create_project(session, payload)
    return ProjectRead.model_validate(project)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(session: SessionDep, project_id: str) -> ProjectRead:
    project = project_services.get_project(session, project_id)
    return ProjectRead.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    session: SessionDep,
    project_id: str,
    payload: ProjectUpdate,
) -> ProjectRead:
    project = project_services.update_project(session, project_id, payload)
    return ProjectRead.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_project(
    session: SessionDep,
    project_id: str,
    payload: ProjectArchive | None = None,
) -> Response:
    project_services.archive_project(
        session,
        project_id,
        finished=payload.finished if payload is not None else None,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{project_id}/unarchive", response_model=ProjectRead)
def unarchive_project(session: SessionDep, project_id: str) -> ProjectRead:
    project = project_services.unarchive_project(session, project_id)
    return ProjectRead.model_validate(project)
