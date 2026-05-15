from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from alembic import command
from alembic.config import Config
from app.core.config import get_settings
from fastapi import Depends
from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_ALEMBIC_INI = _BACKEND_ROOT / "alembic.ini"
_HEAD_REVISION = "head"
_LEGACY_PRE_TITLE_LOCATION_REVISION = "20260513_0002"
_PROJECTS_ONLY_REVISION = "20260513_0001"


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


def _get_alembic_config() -> Config:
    alembic_config = Config(str(_ALEMBIC_INI))
    alembic_config.set_main_option(
        "sqlalchemy.url",
        _prepare_database_url(get_settings().database_url),
    )
    return alembic_config


def _stamp_legacy_schema_if_needed(engine: Engine) -> None:
    inspector = inspect(engine)
    if "alembic_version" in inspector.get_table_names():
        return

    tables = set(inspector.get_table_names())
    if not tables:
        return

    alembic_config = _get_alembic_config()
    if "time_logs" in tables:
        column_names = {column["name"] for column in inspector.get_columns("time_logs")}
        revision = (
            _HEAD_REVISION
            if "title" in column_names
            else _LEGACY_PRE_TITLE_LOCATION_REVISION
        )
        command.stamp(alembic_config, revision)
        return

    if "tasks" in tables:
        command.stamp(alembic_config, _LEGACY_PRE_TITLE_LOCATION_REVISION)
        return

    if "projects" in tables:
        command.stamp(alembic_config, _PROJECTS_ONLY_REVISION)


def init_db() -> None:
    engine = get_engine()
    _stamp_legacy_schema_if_needed(engine)
    command.upgrade(_get_alembic_config(), _HEAD_REVISION)


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
