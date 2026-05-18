from __future__ import annotations

from typing import Any, cast

from app.core.time import utc_now
from app.models.project import Project
from app.models.venture import Venture
from app.models.venture_category_label import VentureCategoryLabel
from app.schemas.venture import (
    VentureCategoryLabelSummary,
    VentureCreate,
    VentureRead,
    VentureStatus,
    VentureUpdate,
)
from fastapi import HTTPException, status
from sqlalchemy import true
from sqlmodel import Session, col, select


def _get_venture_or_404(session: Session, venture_id: str) -> Venture:
    venture = session.get(Venture, venture_id)
    if venture is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venture not found.",
        )
    return venture


def _get_label_or_404(session: Session, label_id: str) -> VentureCategoryLabel:
    label = session.get(VentureCategoryLabel, label_id)
    if label is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venture category label not found.",
        )
    return label


def _get_default_label_or_404(session: Session) -> VentureCategoryLabel:
    label = session.exec(
        select(VentureCategoryLabel).where(VentureCategoryLabel.slug == "hustle")
    ).first()
    if label is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Default venture category label not found.",
        )
    return label


def _to_read(venture: Venture, label: VentureCategoryLabel) -> VentureRead:
    return VentureRead(
        id=venture.id,
        name=venture.name,
        description=venture.description,
        colour=venture.colour,
        category_label_id=venture.category_label_id,
        category_label=VentureCategoryLabelSummary(
            id=label.id,
            name=label.name,
            slug=label.slug,
        ),
        icon=venture.icon,
        status=cast(VentureStatus, venture.status),
        created_at=venture.created_at,
        updated_at=venture.updated_at,
    )


def list_ventures(
    session: Session,
    status_filter: VentureStatus | None,
    category_label_id: str | None,
) -> list[VentureRead]:
    venture_status = status_filter or "active"
    statement = select(Venture).where(Venture.status == venture_status)
    if category_label_id is not None:
        statement = statement.where(Venture.category_label_id == category_label_id)
    statement = statement.order_by(cast(Any, Venture.created_at), cast(Any, Venture.id))
    ventures = list(session.exec(statement))
    if not ventures:
        return []

    label_ids = {venture.category_label_id for venture in ventures}
    labels = list(
        session.exec(select(VentureCategoryLabel).where(col(VentureCategoryLabel.id).in_(label_ids)))
    )
    labels_by_id = {label.id: label for label in labels}
    return [_to_read(venture, labels_by_id[venture.category_label_id]) for venture in ventures]


def create_venture(session: Session, payload: VentureCreate) -> VentureRead:
    label = (
        _get_label_or_404(session, payload.category_label_id)
        if payload.category_label_id is not None
        else _get_default_label_or_404(session)
    )
    venture = Venture(
        name=payload.name.strip(),
        description=payload.description,
        colour=payload.colour,
        category_label_id=label.id,
        icon=payload.icon,
        status="active",
    )
    session.add(venture)
    session.commit()
    session.refresh(venture)
    return _to_read(venture, label)


def get_venture(session: Session, venture_id: str) -> VentureRead:
    venture = _get_venture_or_404(session, venture_id)
    label = _get_label_or_404(session, venture.category_label_id)
    return _to_read(venture, label)


def update_venture(session: Session, venture_id: str, payload: VentureUpdate) -> VentureRead:
    venture = _get_venture_or_404(session, venture_id)
    if venture.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived ventures are read-only.",
        )

    label = _get_label_or_404(session, venture.category_label_id)
    update_data = payload.model_dump(exclude_unset=True)
    if "category_label_id" in update_data:
        category_label_id = update_data["category_label_id"]
        if category_label_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="category_label_id must not be null",
            )
        label = _get_label_or_404(session, category_label_id)

    for field_name, value in update_data.items():
        if field_name == "name" and isinstance(value, str):
            setattr(venture, field_name, value.strip())
        else:
            setattr(venture, field_name, value)
    venture.updated_at = utc_now()

    session.add(venture)
    session.commit()
    session.refresh(venture)
    return _to_read(venture, label)


def archive_venture(session: Session, venture_id: str) -> None:
    venture = _get_venture_or_404(session, venture_id)
    if venture.status == "archived":
        return

    venture.status = "archived"
    venture.updated_at = utc_now()
    session.add(venture)

    projects = list(session.exec(select(Project).where(Project.venture_id == venture.id)))
    for project in projects:
        if project.status == "active":
            project.status = "archived"
            project.archived_by_venture = True
            project.updated_at = utc_now()
            session.add(project)
    session.commit()


def unarchive_venture(session: Session, venture_id: str) -> VentureRead:
    venture = _get_venture_or_404(session, venture_id)
    if venture.status == "archived":
        venture.status = "active"
        venture.updated_at = utc_now()
        session.add(venture)

        projects = list(
            session.exec(
                select(Project).where(
                    Project.venture_id == venture.id,
                    col(Project.archived_by_venture).is_(true()),
                )
            )
        )
        for project in projects:
            project.status = "active"
            project.archived_by_venture = False
            project.updated_at = utc_now()
            session.add(project)
        session.commit()
        session.refresh(venture)

    label = _get_label_or_404(session, venture.category_label_id)
    return _to_read(venture, label)
