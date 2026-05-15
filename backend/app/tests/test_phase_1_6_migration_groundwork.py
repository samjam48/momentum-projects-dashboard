"""Ticket 1.6-1: Phase 1.6 migration and model groundwork.

These tests describe the expected database state after Alembic upgrades add
ventures, venture category labels, project lifecycle fields, and activity types.
Implementation is intentionally deferred to the migration/model ticket.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.database import get_engine
from app.main import create_app

EXPECTED_VENTURE_CATEGORY_LABELS = [
    "Hustle",
    "Business",
    "Investment",
    "Property",
    "Education",
    "Hobby",
]
EXPECTED_ACTIVITY_TYPES = ["planning", "meeting", "admin"]

LEGACY_ACTIVE_PROJECT_ID = "00000000-0000-4000-a000-000000000161"
LEGACY_ARCHIVED_ASSET_PROJECT_ID = "00000000-0000-4000-a000-000000000162"
LEGACY_TASK_ID = "00000000-0000-4000-a000-000000000163"
LEGACY_TIME_LOG_ID = "00000000-0000-4000-a000-000000000164"


def _clear_app_state() -> None:
    get_engine.cache_clear()
    get_settings.cache_clear()


def _run_startup_for_database(
    database_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MOMENTUM_DATABASE_URL", f"sqlite:///{database_path}")
    _clear_app_state()

    try:
        with TestClient(create_app()) as test_client:
            response = test_client.get("/api/v1/health")
            assert response.status_code == 200, response.text
    finally:
        _clear_app_state()


@contextmanager
def _connect(database_path: Path) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(database_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _table_names(database_path: Path) -> set[str]:
    with _connect(database_path) as conn:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {str(row["name"]) for row in rows}


def _column_names(database_path: Path, table_name: str) -> set[str]:
    with _connect(database_path) as conn:
        rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row["name"]) for row in rows}


def _create_phase_1b_populated_database(database_path: Path) -> None:
    """Create a revision-0003 shaped DB with branch-era `is_asset` project data."""

    conn = sqlite3.connect(database_path)
    try:
        cur = conn.cursor()
        cur.executescript(
            """
            CREATE TABLE alembic_version (
              version_num VARCHAR(32) NOT NULL,
              CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
            );
            INSERT INTO alembic_version (version_num) VALUES ('20260514_0003');

            CREATE TABLE projects (
              id VARCHAR NOT NULL,
              name VARCHAR NOT NULL,
              description VARCHAR,
              colour VARCHAR,
              status VARCHAR DEFAULT 'active' NOT NULL,
              is_asset BOOLEAN DEFAULT 0 NOT NULL,
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
              title VARCHAR,
              location VARCHAR,
              PRIMARY KEY (id),
              FOREIGN KEY(task_id) REFERENCES tasks (id),
              FOREIGN KEY(project_id) REFERENCES projects (id)
            );
            """
        )
        cur.execute(
            """
            INSERT INTO projects (
              id, name, description, colour, status, is_asset, created_at, updated_at
            )
            VALUES (?, 'Active legacy project', 'Keep me active', '#D97048', 'active', 0, ?, ?)
            """,
            (
                LEGACY_ACTIVE_PROJECT_ID,
                "2026-05-10T09:00:00+00:00",
                "2026-05-10T09:00:00+00:00",
            ),
        )
        cur.execute(
            """
            INSERT INTO projects (
              id, name, description, colour, status, is_asset, created_at, updated_at
            )
            VALUES (?, 'Archived legacy asset', 'Keep me archived', '#123ABC', 'archived', 1, ?, ?)
            """,
            (
                LEGACY_ARCHIVED_ASSET_PROJECT_ID,
                "2026-05-10T10:00:00+00:00",
                "2026-05-10T10:00:00+00:00",
            ),
        )
        cur.execute(
            """
            INSERT INTO tasks (
              id, project_id, title, description, status, priority,
              estimated_hours, actual_hours, target_date, completed_date,
              kanban_order, created_at, updated_at
            )
            VALUES (?, ?, 'Preserve task', 'Task data survives migration', 'review',
                    'high', 4.5, 1.25, '2026-05-31', NULL, 7, ?, ?)
            """,
            (
                LEGACY_TASK_ID,
                LEGACY_ACTIVE_PROJECT_ID,
                "2026-05-10T11:00:00+00:00",
                "2026-05-10T11:00:00+00:00",
            ),
        )
        cur.execute(
            """
            INSERT INTO time_logs (
              id, task_id, project_id, hours, logged_date, source, external_id,
              notes, created_at, title, location
            )
            VALUES (?, ?, ?, 1.25, '2026-05-13', 'manual', NULL,
                    'Preserve notes', ?, 'Legacy title', 'Home office')
            """,
            (
                LEGACY_TIME_LOG_ID,
                LEGACY_TASK_ID,
                LEGACY_ACTIVE_PROJECT_ID,
                "2026-05-13T12:00:00+00:00",
            ),
        )
        conn.commit()
    finally:
        conn.close()


def test_empty_database_upgrade_seeds_phase_1_6_foundation_idempotently(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_path = tmp_path / "phase-1-6-empty.db"

    _run_startup_for_database(database_path, monkeypatch)
    _run_startup_for_database(database_path, monkeypatch)

    assert {
        "venture_category_labels",
        "ventures",
        "activity_types",
    }.issubset(_table_names(database_path))

    assert {
        "venture_id",
        "icon",
        "project_type",
        "board_status",
        "kanban_order",
        "finished",
        "archived_by_venture",
    }.issubset(_column_names(database_path, "projects"))
    assert "activity_type_id" in _column_names(database_path, "time_logs")

    with _connect(database_path) as conn:
        labels = conn.execute(
            "SELECT name, slug FROM venture_category_labels ORDER BY rowid",
        ).fetchall()
        activity_types = conn.execute(
            "SELECT name, slug, status FROM activity_types ORDER BY rowid",
        ).fetchall()
        ventures = conn.execute(
            """
            SELECT ventures.name, ventures.status, venture_category_labels.name AS category_name
            FROM ventures
            JOIN venture_category_labels
              ON venture_category_labels.id = ventures.category_label_id
            ORDER BY ventures.rowid
            """,
        ).fetchall()

    assert [row["name"] for row in labels] == EXPECTED_VENTURE_CATEGORY_LABELS
    assert [row["slug"] for row in labels] == [
        label.lower() for label in EXPECTED_VENTURE_CATEGORY_LABELS
    ]
    assert [row["name"] for row in activity_types] == EXPECTED_ACTIVITY_TYPES
    assert [row["slug"] for row in activity_types] == EXPECTED_ACTIVITY_TYPES
    assert {row["status"] for row in activity_types} == {"active"}
    assert len(ventures) == 1
    assert dict(ventures[0]) == {
        "name": "Unsorted",
        "status": "active",
        "category_name": "Hustle",
    }


def test_populated_database_upgrade_backfills_projects_and_preserves_existing_data(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_path = tmp_path / "phase-1-6-populated.db"
    _create_phase_1b_populated_database(database_path)

    _run_startup_for_database(database_path, monkeypatch)

    assert {
        "venture_category_labels",
        "ventures",
        "activity_types",
    }.issubset(_table_names(database_path))

    with _connect(database_path) as conn:
        unsorted_venture = conn.execute(
            """
            SELECT ventures.id,
                   ventures.name,
                   ventures.status,
                   venture_category_labels.name AS category_name
            FROM ventures
            JOIN venture_category_labels
              ON venture_category_labels.id = ventures.category_label_id
            WHERE ventures.name = 'Unsorted'
            """,
        ).fetchone()
        projects = conn.execute(
            """
            SELECT id, venture_id, status, project_type, board_status,
                   kanban_order, finished, archived_by_venture
            FROM projects
            ORDER BY id
            """,
        ).fetchall()
        task = conn.execute(
            "SELECT project_id, status, priority, kanban_order FROM tasks WHERE id = ?",
            (LEGACY_TASK_ID,),
        ).fetchone()
        time_log = conn.execute(
            """
            SELECT task_id, project_id, notes, title, location, activity_type_id
            FROM time_logs
            WHERE id = ?
            """,
            (LEGACY_TIME_LOG_ID,),
        ).fetchone()
        uncategorised_rows = conn.execute(
            "SELECT COUNT(*) AS count FROM activity_types WHERE slug = 'uncategorised'",
        ).fetchone()

    assert unsorted_venture is not None
    assert dict(unsorted_venture) == {
        "id": unsorted_venture["id"],
        "name": "Unsorted",
        "status": "active",
        "category_name": "Hustle",
    }

    projects_by_id = {str(row["id"]): row for row in projects}
    assert set(projects_by_id) == {
        LEGACY_ACTIVE_PROJECT_ID,
        LEGACY_ARCHIVED_ASSET_PROJECT_ID,
    }
    assert {
        row["venture_id"] for row in projects_by_id.values()
    } == {unsorted_venture["id"]}
    assert dict(projects_by_id[LEGACY_ACTIVE_PROJECT_ID]) == {
        "id": LEGACY_ACTIVE_PROJECT_ID,
        "venture_id": unsorted_venture["id"],
        "status": "active",
        "project_type": "project",
        "board_status": "active",
        "kanban_order": None,
        "finished": 0,
        "archived_by_venture": 0,
    }
    assert dict(projects_by_id[LEGACY_ARCHIVED_ASSET_PROJECT_ID]) == {
        "id": LEGACY_ARCHIVED_ASSET_PROJECT_ID,
        "venture_id": unsorted_venture["id"],
        "status": "archived",
        "project_type": "asset",
        "board_status": "active",
        "kanban_order": None,
        "finished": 0,
        "archived_by_venture": 0,
    }

    assert dict(task) == {
        "project_id": LEGACY_ACTIVE_PROJECT_ID,
        "status": "review",
        "priority": "high",
        "kanban_order": 7,
    }
    assert dict(time_log) == {
        "task_id": LEGACY_TASK_ID,
        "project_id": LEGACY_ACTIVE_PROJECT_ID,
        "notes": "Preserve notes",
        "title": "Legacy title",
        "location": "Home office",
        "activity_type_id": None,
    }
    assert uncategorised_rows is not None
    assert uncategorised_rows["count"] == 0


def test_project_create_requires_active_venture_id(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_path = tmp_path / "phase-1-6-create-validation.db"
    _run_startup_for_database(database_path, monkeypatch)

    with _connect(database_path) as conn:
        unsorted_venture = conn.execute(
            "SELECT id FROM ventures WHERE name = 'Unsorted'",
        ).fetchone()
    assert unsorted_venture is not None

    monkeypatch.setenv("MOMENTUM_DATABASE_URL", f"sqlite:///{database_path}")
    _clear_app_state()
    try:
        with TestClient(create_app()) as test_client:
            missing_venture_id_response = test_client.post(
                "/api/v1/projects",
                json={"name": "Missing venture"},
            )
            assert missing_venture_id_response.status_code == 422

            unknown_venture_id_response = test_client.post(
                "/api/v1/projects",
                json={
                    "venture_id": "00000000-0000-4000-a000-000000000999",
                    "name": "Unknown venture",
                },
            )
            assert unknown_venture_id_response.status_code == 404

            valid_response = test_client.post(
                "/api/v1/projects",
                json={
                    "venture_id": unsorted_venture["id"],
                    "name": "Valid venture project",
                },
            )
            assert valid_response.status_code == 201, valid_response.text
    finally:
        _clear_app_state()


def test_project_update_rejects_unknown_venture_id(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_path = tmp_path / "phase-1-6-update-validation.db"
    _run_startup_for_database(database_path, monkeypatch)

    with _connect(database_path) as conn:
        unsorted_venture = conn.execute(
            "SELECT id FROM ventures WHERE name = 'Unsorted'",
        ).fetchone()
    assert unsorted_venture is not None

    monkeypatch.setenv("MOMENTUM_DATABASE_URL", f"sqlite:///{database_path}")
    _clear_app_state()
    try:
        with TestClient(create_app()) as test_client:
            create_response = test_client.post(
                "/api/v1/projects",
                json={
                    "venture_id": unsorted_venture["id"],
                    "name": "Project to reassign",
                },
            )
            assert create_response.status_code == 201, create_response.text
            project_id = create_response.json()["id"]

            response = test_client.patch(
                f"/api/v1/projects/{project_id}",
                json={"venture_id": "00000000-0000-4000-a000-000000000888"},
            )
            assert response.status_code == 404

            clear_response = test_client.patch(
                f"/api/v1/projects/{project_id}",
                json={"venture_id": None},
            )
            assert clear_response.status_code == 422
    finally:
        _clear_app_state()
