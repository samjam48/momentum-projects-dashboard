"""Ticket 1b-7: stale SQLite time_logs schema (pre title/location columns).

Real installs can keep an on-disk SQLite file while migrations add nullable columns.
`init_db()` must bring the schema to head (Alembic upgrade) so GET/POST time-log
routes return success instead of 500 from ORM/table mismatch.

This integration test intentionally seeds a legacy schema; implementation is deferred.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.database import get_engine
from app.main import create_app

TASKS_ENDPOINT = "/api/v1/tasks"

_STALE_PROJECT_ID = "00000000-0000-4000-a000-000000000051"
_STALE_TASK_ID = "00000000-0000-4000-a000-000000000052"


def _create_sqlite_without_time_log_title_location(db_path: Path) -> None:
    """Schema matching revisions 20260513_0001 + 20260513_0002 only (no 0003 columns)."""

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.executescript(
            """
            CREATE TABLE projects (
              id VARCHAR NOT NULL,
              name VARCHAR NOT NULL,
              description VARCHAR,
              colour VARCHAR,
              status VARCHAR DEFAULT 'active' NOT NULL,
              created_at DATETIME NOT NULL,
              updated_at DATETIME NOT NULL,
              PRIMARY KEY (id)
            );

            CREATE TABLE tasks (
              id VARCHAR NOT NULL,
              project_id VARCHAR NOT NULL,
              title VARCHAR NOT NULL,
              description VARCHAR,
              status VARCHAR DEFAULT 'backlog' NOT NULL,
              priority VARCHAR DEFAULT 'medium' NOT NULL,
              estimated_hours FLOAT,
              actual_hours FLOAT DEFAULT '0' NOT NULL,
              target_date DATE,
              completed_date DATE,
              kanban_order INTEGER,
              created_at DATETIME NOT NULL,
              updated_at DATETIME NOT NULL,
              PRIMARY KEY (id),
              FOREIGN KEY(project_id) REFERENCES projects (id)
            );

            CREATE TABLE time_logs (
              id VARCHAR NOT NULL,
              task_id VARCHAR NOT NULL,
              project_id VARCHAR NOT NULL,
              hours FLOAT NOT NULL,
              logged_date DATE NOT NULL,
              source VARCHAR DEFAULT 'manual' NOT NULL,
              external_id VARCHAR,
              notes VARCHAR,
              created_at DATETIME NOT NULL,
              PRIMARY KEY (id),
              FOREIGN KEY(task_id) REFERENCES tasks (id),
              FOREIGN KEY(project_id) REFERENCES projects (id)
            );
            """
        )
        cur.execute(
            """
            INSERT INTO projects (
              id, name, description, colour, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 'active', ?, ?)
            """,
            (
                _STALE_PROJECT_ID,
                "Legacy schema project",
                None,
                "#D97048",
                "2026-05-01T12:00:00+00:00",
                "2026-05-01T12:00:00+00:00",
            ),
        )
        cur.execute(
            """
            INSERT INTO tasks (
              id, project_id, title, description, status, priority,
              estimated_hours, actual_hours, target_date, completed_date,
              kanban_order, created_at, updated_at
            )
            VALUES (?, ?, ?, NULL, 'backlog', 'medium', NULL, 0,
                    '2026-05-31', NULL, NULL, ?, ?)
            """,
            (
                _STALE_TASK_ID,
                _STALE_PROJECT_ID,
                "Stale DB task",
                "2026-05-01T12:00:00+00:00",
                "2026-05-01T12:00:00+00:00",
            ),
        )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def stale_time_log_database_client(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[TestClient]:
    database_path = tmp_path / "stale-time-logs.db"
    _create_sqlite_without_time_log_title_location(database_path)

    monkeypatch.setenv("MOMENTUM_DATABASE_URL", f"sqlite:///{database_path}")
    get_settings.cache_clear()
    get_engine.cache_clear()

    with TestClient(create_app(), raise_server_exceptions=False) as test_client:
        yield test_client

    get_engine.cache_clear()
    get_settings.cache_clear()


def test_time_log_get_and_post_succeed_after_init_on_stale_time_logs_schema(
    stale_time_log_database_client: TestClient,
) -> None:
    """App startup (`init_db` / Alembic upgrade) aligns schema; endpoints must not 500."""

    logs_response = stale_time_log_database_client.get(
        f"{TASKS_ENDPOINT}/{_STALE_TASK_ID}/time-logs",
    )
    assert logs_response.status_code == 200, logs_response.text

    create_response = stale_time_log_database_client.post(
        f"{TASKS_ENDPOINT}/{_STALE_TASK_ID}/time-logs",
        json={
            "hours": 1.25,
            "logged_date": "2026-05-12",
            "notes": "Work after implicit migration.",
        },
    )
    assert create_response.status_code == 201, create_response.text
