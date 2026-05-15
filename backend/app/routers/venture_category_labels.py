from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.db.database import SessionDep
from app.schemas.venture_category_label import (
    VentureCategoryLabelCreate,
    VentureCategoryLabelRead,
    VentureCategoryLabelUpdate,
)
from app.services import venture_category_labels

router = APIRouter(prefix="/venture-category-labels")


@router.get("", response_model=list[VentureCategoryLabelRead])
def list_venture_category_labels(session: SessionDep) -> list[VentureCategoryLabelRead]:
    return venture_category_labels.list_labels(session)


@router.post("", response_model=VentureCategoryLabelRead, status_code=status.HTTP_201_CREATED)
def create_venture_category_label(
    session: SessionDep,
    payload: VentureCategoryLabelCreate,
) -> VentureCategoryLabelRead:
    return venture_category_labels.create_label(session, payload)


@router.patch("/{label_id}", response_model=VentureCategoryLabelRead)
def update_venture_category_label(
    session: SessionDep,
    label_id: str,
    payload: VentureCategoryLabelUpdate,
) -> VentureCategoryLabelRead:
    return venture_category_labels.update_label(session, label_id, payload)


@router.delete("/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venture_category_label(session: SessionDep, label_id: str) -> Response:
    venture_category_labels.delete_label(session, label_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
