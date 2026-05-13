from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from app.core.config import get_settings
from fastapi import Depends
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine


def _prepare_database_url(database_url: str) -> str:
    if not database_url.startswith("sqlite:///"):
        return database_url

    database_path = database_url.removeprefix("sqlite:///")
    resolved_path = Path(database_path).expanduser()
    if not resolved_path.is_absolute():
        resolved_path = Path.cwd() / resolved_path
    resolved_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{resolved_path}"


@lru_cache
def get_engine() -> Engine:
    database_url = _prepare_database_url(get_settings().database_url)
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(get_engine())


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
