from __future__ import annotations

import re

from app.core.time import utc_now
from app.models.venture import Venture
from app.models.venture_category_label import VentureCategoryLabel
from app.schemas.pagination import PaginatedResponse, decode_cursor, encode_cursor
from app.schemas.venture_category_label import (
    VentureCategoryLabelCreate,
    VentureCategoryLabelRead,
    VentureCategoryLabelUpdate,
)
from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlmodel import Session, col, select

_SLUG_NON_ALNUM_PATTERN = re.compile(r"[^a-z0-9]+")
_SEEDED_ORDER = {
    "hustle": 0,
    "business": 1,
    "investment": 2,
    "property": 3,
    "education": 4,
    "hobby": 5,
}


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


def _ensure_slug_unique(
    session: Session,
    slug: str,
    current_label_id: str | None = None,
) -> None:
    statement = select(VentureCategoryLabel).where(
        func.lower(VentureCategoryLabel.slug) == slug.lower()
    )
    existing = session.exec(statement).first()
    if existing is None:
        return
    if current_label_id is not None and existing.id == current_label_id:
        return
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="name already exists",
    )


def _get_label_or_404(session: Session, label_id: str) -> VentureCategoryLabel:
    label = session.get(VentureCategoryLabel, label_id)
    if label is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venture category label not found.",
        )
    return label


def _load_usage_counts(session: Session) -> dict[str, int]:
    usage_rows = session.exec(
        select(Venture.category_label_id, func.count())
        .group_by(Venture.category_label_id)
    ).all()
    return {label_id: int(count) for label_id, count in usage_rows}


def _build_read_rows(
    labels: list[VentureCategoryLabel],
    usage_counts: dict[str, int],
) -> list[VentureCategoryLabelRead]:
    return [
        VentureCategoryLabelRead(
            id=label.id,
            name=label.name,
            slug=label.slug,
            created_at=label.created_at,
            updated_at=label.updated_at,
            usage_count=usage_counts.get(label.id, 0),
        )
        for label in labels
    ]


def list_labels(
    session: Session,
) -> list[VentureCategoryLabelRead] | PaginatedResponse[VentureCategoryLabelRead]:
    return list_labels_paginated(session, limit=None, cursor=None)


def list_labels_paginated(
    session: Session,
    *,
    limit: int | None,
    cursor: str | None,
) -> list[VentureCategoryLabelRead] | PaginatedResponse[VentureCategoryLabelRead]:
    if cursor is not None and limit is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="cursor requires limit.",
        )

    seeded_rank = case(
        _SEEDED_ORDER,
        value=func.lower(col(VentureCategoryLabel.slug)),
        else_=999,
    )
    labels = list(
        session.exec(
            select(VentureCategoryLabel).order_by(
                seeded_rank,
                col(VentureCategoryLabel.name),
                col(VentureCategoryLabel.id),
            )
        )
    )
    if limit is None:
        return _build_read_rows(labels, _load_usage_counts(session))

    start_index = 0
    if cursor is not None:
        try:
            cursor_values = decode_cursor(cursor)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor.",
            ) from exc
        if len(cursor_values) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor.",
            )
        cursor_id = cursor_values[0]
        matching_indices = [idx for idx, row in enumerate(labels) if row.id == cursor_id]
        if not matching_indices:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor.",
            )
        start_index = matching_indices[0] + 1

    page_items = labels[start_index : start_index + limit]
    has_more = start_index + limit < len(labels)
    usage_counts = _load_usage_counts(session)
    next_cursor = encode_cursor((page_items[-1].id,)) if has_more and page_items else None
    return PaginatedResponse(
        items=_build_read_rows(page_items, usage_counts),
        next_cursor=next_cursor,
    )


def create_label(
    session: Session,
    payload: VentureCategoryLabelCreate,
) -> VentureCategoryLabelRead:
    slug = _slugify(payload.name)
    _ensure_slug_unique(session, slug)
    label = VentureCategoryLabel(
        name=_to_title_case(payload.name.strip()),
        slug=slug,
    )
    session.add(label)
    session.commit()
    session.refresh(label)
    return VentureCategoryLabelRead(
        id=label.id,
        name=label.name,
        slug=label.slug,
        created_at=label.created_at,
        updated_at=label.updated_at,
        usage_count=0,
    )


def update_label(
    session: Session,
    label_id: str,
    payload: VentureCategoryLabelUpdate,
) -> VentureCategoryLabelRead:
    label = _get_label_or_404(session, label_id)
    slug = _slugify(payload.name)
    _ensure_slug_unique(session, slug, current_label_id=label.id)
    label.name = _to_title_case(payload.name.strip())
    label.slug = slug
    label.updated_at = utc_now()
    session.add(label)
    session.commit()
    session.refresh(label)
    usage_count = _load_usage_counts(session).get(label.id, 0)
    return VentureCategoryLabelRead(
        id=label.id,
        name=label.name,
        slug=label.slug,
        created_at=label.created_at,
        updated_at=label.updated_at,
        usage_count=usage_count,
    )


def delete_label(session: Session, label_id: str) -> None:
    label = _get_label_or_404(session, label_id)
    usage_count = int(
        session.exec(
            select(func.count()).where(Venture.category_label_id == label.id)
        ).one()
    )
    if usage_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Label is in use by one or more ventures.",
        )
    session.delete(label)
    session.commit()
