"""Shared helpers for venture-aware legacy API tests (Phase 1.6-C2).

Aligned with patterns in ``test_projects_phase_1_6_4.py``: insert an active Venture
via SQLModel so POST /projects always receives a valid ``venture_id``.
"""

from __future__ import annotations

from uuid import uuid4

from sqlmodel import Session, select

from app.db.database import get_engine
from app.models.venture import Venture
from app.models.venture_category_label import VentureCategoryLabel


def hustle_category_label_id() -> str:
    with Session(get_engine()) as session:
        label = session.exec(
            select(VentureCategoryLabel).where(VentureCategoryLabel.name == "Hustle"),
        ).first()
    assert label is not None
    return label.id


def create_active_venture_in_db(name: str | None = None, *, status: str = "active") -> str:
    """Create a venture row and return its id (fresh DB-friendly)."""
    venture_id = str(uuid4())
    venture = Venture(
        id=venture_id,
        name=name or f"Legacy test venture {uuid4().hex[:8]}",
        description=None,
        colour="#D97048",
        category_label_id=hustle_category_label_id(),
        icon=None,
        status=status,
    )
    with Session(get_engine()) as session:
        session.add(venture)
        session.commit()
    return venture_id
