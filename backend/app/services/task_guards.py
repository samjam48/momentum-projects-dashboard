from __future__ import annotations

from app.models.project import Project
from app.models.task import Task
from app.models.venture import Venture
from fastapi import HTTPException, status
from sqlmodel import Session


def ensure_project_mutable(session: Session, project_id: str) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    venture_id = project.venture_id
    if venture_id is not None:
        venture = session.get(Venture, venture_id)
        if venture is None or venture.status != "active":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Projects under archived ventures cannot accept task changes.",
            )

    if project.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived projects cannot accept task changes.",
        )
    return project


def ensure_task_mutable(session: Session, task_id: str) -> Task:
    task = session.get(Task, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    ensure_project_mutable(session, task.project_id)
    return task
