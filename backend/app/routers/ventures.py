from __future__ import annotations

from fastapi import APIRouter, Query, Response, status

from app.db.database import SessionDep
from app.schemas.venture import VentureCreate, VentureRead, VentureStatus, VentureUpdate
from app.services import ventures

router = APIRouter(prefix="/ventures")


@router.get("", response_model=list[VentureRead])
def list_ventures(
    session: SessionDep,
    status_filter: VentureStatus | None = Query(default=None, alias="status"),
    category_label_id: str | None = None,
) -> list[VentureRead]:
    return ventures.list_ventures(session, status_filter, category_label_id)


@router.post("", response_model=VentureRead, status_code=status.HTTP_201_CREATED)
def create_venture(session: SessionDep, payload: VentureCreate) -> VentureRead:
    return ventures.create_venture(session, payload)


@router.get("/{venture_id}", response_model=VentureRead)
def get_venture(session: SessionDep, venture_id: str) -> VentureRead:
    return ventures.get_venture(session, venture_id)


@router.patch("/{venture_id}", response_model=VentureRead)
def update_venture(
    session: SessionDep,
    venture_id: str,
    payload: VentureUpdate,
) -> VentureRead:
    return ventures.update_venture(session, venture_id, payload)


@router.delete("/{venture_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_venture(session: SessionDep, venture_id: str) -> Response:
    ventures.archive_venture(session, venture_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{venture_id}/unarchive", response_model=VentureRead)
def unarchive_venture(session: SessionDep, venture_id: str) -> VentureRead:
    return ventures.unarchive_venture(session, venture_id)
