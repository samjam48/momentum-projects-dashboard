"""Ticket 1.6-12: phase-level regression, migration API checks, and integration guards."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.config import get_settings
from app.db.database import get_engine
from app.main import create_app
from app.models.time_log import TimeLog
from app.models.venture_category_label import VentureCategoryLabel
from app.tests.test_phase_1_6_migration_groundwork import (
    LEGACY_ACTIVE_PROJECT_ID,
    LEGACY_ARCHIVED_ASSET_PROJECT_ID,
    LEGACY_TASK_ID,
    LEGACY_TIME_LOG_ID,
    _column_names,
    _connect,
    _create_phase_1b_populated_database,
)

APP_DIR = Path(__file__).resolve().parents[1]


def _clear_app_state() -> None:
    get_engine.cache_clear()
    get_settings.cache_clear()


def _task_layer_paths() -> list[Path]:
    return [
        APP_DIR / "models" / "task.py",
        APP_DIR / "schemas" / "task.py",
        APP_DIR / "routers" / "tasks.py",
        APP_DIR / "services" / "tasks.py",
    ]


@pytest.mark.parametrize(
    ("pattern", "reason"),
    [
        (r"\btask_type\b", "task_type must not ship on tasks"),
        (r"\btask_labels\b", "task multi-label fields are out of scope"),
        (r"\bsemantic_colou?r\b", "task semantic colour is out of scope"),
        (r"\blabel_ids\b", "task label collections are out of scope"),
    ],
)
def test_task_python_layers_exclude_removed_taxonomy_fields(pattern: str, reason: str) -> None:
    combined = "\n".join(path.read_text(encoding="utf-8") for path in _task_layer_paths())
    assert re.search(pattern, combined) is None, reason


def test_task_model_has_no_colour_or_type_columns() -> None:
    task_model_source = (APP_DIR / "models" / "task.py").read_text(encoding="utf-8")
    class_slice = task_model_source.split("class Task", 1)[1]
    body = class_slice.split("class ", 1)[0]
    assert " colour" not in body and "\tcolour" not in body and "colour:" not in body
    assert "type:" not in body


def test_openapi_task_read_schema_excludes_removed_fields(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200, response.text
    schemas = response.json()["components"]["schemas"]
    task_schema = cast(dict[str, Any], schemas["TaskRead"])
    properties: dict[str, Any] = task_schema.get("properties", {})
    forbidden = {"task_type", "labels", "label_ids", "semantic_colour", "semantic_color", "colour"}
    assert forbidden.isdisjoint(properties.keys())


def test_populated_migration_surfaces_uncategorised_time_log_display_via_api(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_path = tmp_path / "phase-1-6-12-populated.db"
    _create_phase_1b_populated_database(database_path)

    monkeypatch.setenv("MOMENTUM_DATABASE_URL", f"sqlite:///{database_path}")
    _clear_app_state()
    try:
        with TestClient(create_app()) as test_client:
            logs_response = test_client.get(f"/api/v1/tasks/{LEGACY_TASK_ID}/time-logs")
            assert logs_response.status_code == 200, logs_response.text
            logs = logs_response.json()
            legacy = next(log for log in logs if log["id"] == LEGACY_TIME_LOG_ID)
            assert legacy["activity_type_id"] is None
            assert legacy["activity_type_display_name"] == "uncategorised"
    finally:
        _clear_app_state()


def test_populated_migration_api_exposes_unsorted_ownership_and_asset_project_type(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: migrated rows surface Unsorted venture ownership via public APIs."""
    database_path = tmp_path / "phase-1-6-12-migration-api.db"
    _create_phase_1b_populated_database(database_path)

    monkeypatch.setenv("MOMENTUM_DATABASE_URL", f"sqlite:///{database_path}")
    _clear_app_state()
    try:
        with TestClient(create_app()) as test_client:
            ventures = test_client.get("/api/v1/ventures").json()
            unsorted = next(v for v in ventures if v["name"] == "Unsorted")
            venture_id = unsorted["id"]

            active_rows = test_client.get(
                "/api/v1/projects",
                params={"venture_id": venture_id, "status": "active"},
            ).json()
            active_match = next(p for p in active_rows if p["id"] == LEGACY_ACTIVE_PROJECT_ID)
            assert active_match["project_type"] == "project"

            archived_rows = test_client.get(
                "/api/v1/projects",
                params={"venture_id": venture_id, "status": "archived"},
            ).json()
            archived_match = next(
                p for p in archived_rows if p["id"] == LEGACY_ARCHIVED_ASSET_PROJECT_ID
            )
            assert archived_match["project_type"] == "asset"

            task_detail = test_client.get(f"/api/v1/tasks/{LEGACY_TASK_ID}").json()
            assert task_detail["status"] == "review"
            assert task_detail["kanban_order"] == 7
    finally:
        _clear_app_state()


def test_populated_migration_sqlite_maps_is_asset_consistently_with_project_type(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If legacy is_asset remains on SQLite, every row must agree with project_type."""
    database_path = tmp_path / "phase-1-6-12-asset-consistency.db"
    _create_phase_1b_populated_database(database_path)

    monkeypatch.setenv("MOMENTUM_DATABASE_URL", f"sqlite:///{database_path}")
    _clear_app_state()
    try:
        with TestClient(create_app()):
            pass
    finally:
        _clear_app_state()

    project_columns = _column_names(database_path, "projects")
    if "is_asset" in project_columns:
        with _connect(database_path) as conn:
            stray = conn.execute(
                """
                SELECT COUNT(*) AS n FROM projects
                WHERE (is_asset = 1 AND project_type != 'asset')
                   OR (is_asset = 0 AND project_type = 'asset')
                """
            ).fetchone()
            assert stray is not None
            assert stray["n"] == 0


def test_openapi_project_schemas_exclude_legacy_is_asset_field(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200, response.text
    schemas = cast(dict[str, Any], response.json()["components"]["schemas"])
    for schema_name, schema in schemas.items():
        if not schema_name.startswith("Project"):
            continue
        fragments: list[dict[str, Any]] = []
        if "properties" in schema:
            fragments.append(cast(dict[str, Any], schema))
        if "allOf" in schema:
            for entry in cast(list[dict[str, Any]], schema["allOf"]):
                ref = entry.get("$ref")
                if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
                    nested_name = ref.rsplit("/", maxsplit=1)[-1]
                    nested = schemas.get(nested_name)
                    if isinstance(nested, dict) and "properties" in nested:
                        fragments.append(cast(dict[str, Any], nested))
        for fragment in fragments:
            property_keys = fragment.get("properties", {}).keys()
            assert "is_asset" not in property_keys, (
                f"{schema_name} must not expose legacy is_asset (use project_type)"
            )


def test_archiving_venture_hides_active_child_projects_from_venture_scoped_list(
    client: TestClient,
) -> None:
    hustle = client.get("/api/v1/venture-category-labels").json()
    hustle_id = next(row["id"] for row in hustle if row["slug"] == "hustle")

    venture_resp = client.post(
        "/api/v1/ventures",
        json={
            "name": "Cascade List Venture",
            "category_label_id": hustle_id,
        },
    )
    assert venture_resp.status_code == 201, venture_resp.text
    venture_id = venture_resp.json()["id"]

    project_resp = client.post(
        "/api/v1/projects",
        json={
            "venture_id": venture_id,
            "name": "Child visible before voyage archive",
            "colour": "#D97048",
        },
    )
    assert project_resp.status_code == 201, project_resp.text
    project_id = project_resp.json()["id"]

    listed_before = client.get(
        "/api/v1/projects",
        params={"venture_id": venture_id, "status": "active"},
    )
    assert listed_before.status_code == 200, listed_before.text
    assert [row["id"] for row in listed_before.json()] == [project_id]

    archive_venture = client.delete(f"/api/v1/ventures/{venture_id}")
    assert archive_venture.status_code in {200, 204}, archive_venture.text

    listed_mid = client.get(
        "/api/v1/projects",
        params={"venture_id": venture_id, "status": "active"},
    )
    assert listed_mid.status_code == 200, listed_mid.text
    assert listed_mid.json() == []

    restore = client.patch(f"/api/v1/ventures/{venture_id}/unarchive")
    assert restore.status_code == 200, restore.text

    listed_after = client.get(
        "/api/v1/projects",
        params={"venture_id": venture_id, "status": "active"},
    )
    assert listed_after.status_code == 200, listed_after.text
    assert [row["id"] for row in listed_after.json()] == [project_id]


def test_unarchive_venture_restores_only_cascade_archived_projects(
    client: TestClient,
) -> None:
    """Pre-venture manual archives stay archived; cascade-archived children return active."""
    hustle = client.get("/api/v1/venture-category-labels").json()
    hustle_id = next(row["id"] for row in hustle if row["slug"] == "hustle")

    venture_resp = client.post(
        "/api/v1/ventures",
        json={"name": "Cascade restore venture", "category_label_id": hustle_id},
    )
    assert venture_resp.status_code == 201, venture_resp.text
    venture_id = venture_resp.json()["id"]

    active_child = client.post(
        "/api/v1/projects",
        json={
            "venture_id": venture_id,
            "name": "Live before cascade",
            "colour": "#D97048",
        },
    )
    assert active_child.status_code == 201, active_child.text
    active_child_id = active_child.json()["id"]

    pre_archived = client.post(
        "/api/v1/projects",
        json={
            "venture_id": venture_id,
            "name": "User archived early",
            "colour": "#D97048",
        },
    )
    assert pre_archived.status_code == 201, pre_archived.text
    pre_archived_id = pre_archived.json()["id"]

    manual_archive = client.delete(f"/api/v1/projects/{pre_archived_id}")
    assert manual_archive.status_code in {200, 204}, manual_archive.text

    pre_body = client.get(f"/api/v1/projects/{pre_archived_id}").json()
    assert pre_body["status"] == "archived"
    assert pre_body["archived_by_venture"] is False

    cascade_archive_venture = client.delete(f"/api/v1/ventures/{venture_id}")
    assert cascade_archive_venture.status_code in {200, 204}, cascade_archive_venture.text

    after_venture_archive_active = client.get(f"/api/v1/projects/{active_child_id}").json()
    assert after_venture_archive_active["status"] == "archived"
    assert after_venture_archive_active["archived_by_venture"] is True

    after_venture_archive_pre = client.get(f"/api/v1/projects/{pre_archived_id}").json()
    assert after_venture_archive_pre["status"] == "archived"
    assert after_venture_archive_pre["archived_by_venture"] is False

    restore_venture = client.patch(f"/api/v1/ventures/{venture_id}/unarchive")
    assert restore_venture.status_code == 200, restore_venture.text

    restored_active = client.get(f"/api/v1/projects/{active_child_id}").json()
    assert restored_active["status"] == "active"
    assert restored_active["archived_by_venture"] is False

    still_archived = client.get(f"/api/v1/projects/{pre_archived_id}").json()
    assert still_archived["status"] == "archived"
    assert still_archived["archived_by_venture"] is False


def test_archiving_active_project_uses_finished_false_when_not_shipped(
    client: TestClient,
) -> None:
    hustle = client.get("/api/v1/venture-category-labels").json()
    hustle_id = next(row["id"] for row in hustle if row["slug"] == "hustle")
    venture_resp = client.post(
        "/api/v1/ventures",
        json={"name": "Finished Semantics Venture", "category_label_id": hustle_id},
    )
    assert venture_resp.status_code == 201, venture_resp.text
    venture_id = venture_resp.json()["id"]

    project_resp = client.post(
        "/api/v1/projects",
        json={
            "venture_id": venture_id,
            "name": "Active lane project",
            "colour": "#D97048",
            "board_status": "active",
            "finished": False,
        },
    )
    assert project_resp.status_code == 201, project_resp.text
    project_id = project_resp.json()["id"]

    archive = client.delete(f"/api/v1/projects/{project_id}")
    assert archive.status_code in {200, 204}, archive.text

    detail = client.get(f"/api/v1/projects/{project_id}")
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["finished"] is False
    assert body["board_status"] == "active"


def test_archiving_shipped_column_project_defaults_finished_true(
    client: TestClient,
) -> None:
    hustle = client.get("/api/v1/venture-category-labels").json()
    hustle_id = next(row["id"] for row in hustle if row["slug"] == "hustle")
    venture_resp = client.post(
        "/api/v1/ventures",
        json={"name": "Shipped Archive Venture", "category_label_id": hustle_id},
    )
    assert venture_resp.status_code == 201, venture_resp.text
    venture_id = venture_resp.json()["id"]

    project_resp = client.post(
        "/api/v1/projects",
        json={
            "venture_id": venture_id,
            "name": "Shipped card",
            "colour": "#D97048",
            "board_status": "shipped",
            "finished": True,
        },
    )
    assert project_resp.status_code == 201, project_resp.text
    project_id = project_resp.json()["id"]

    archive = client.delete(f"/api/v1/projects/{project_id}")
    assert archive.status_code in {200, 204}, archive.text

    detail = client.get(f"/api/v1/projects/{project_id}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["finished"] is True


def test_runtime_task_api_payloads_exclude_removed_taxonomy_fields(client: TestClient) -> None:
    """Regression: live task JSON must not add type, labels, or semantic colour keys."""
    forbidden = {
        "task_type",
        "labels",
        "label_ids",
        "semantic_colour",
        "semantic_color",
        "colour",
    }
    hustle = client.get("/api/v1/venture-category-labels").json()
    hustle_id = next(row["id"] for row in hustle if row["slug"] == "hustle")

    venture_resp = client.post(
        "/api/v1/ventures",
        json={"name": "Payload taxonomy venture", "category_label_id": hustle_id},
    )
    assert venture_resp.status_code == 201, venture_resp.text
    venture_id = venture_resp.json()["id"]

    project_resp = client.post(
        "/api/v1/projects",
        json={"venture_id": venture_id, "name": "Payload taxonomy project", "colour": "#D97048"},
    )
    assert project_resp.status_code == 201, project_resp.text
    project_id = project_resp.json()["id"]

    task_resp = client.post(
        "/api/v1/tasks",
        json={
            "project_id": project_id,
            "title": "taxonomy probe",
            "status": "backlog",
            "priority": "medium",
        },
    )
    assert task_resp.status_code == 201, task_resp.text
    task_id = task_resp.json()["id"]

    listing = client.get("/api/v1/tasks", params={"project_id": project_id})
    assert listing.status_code == 200, listing.text
    rows = listing.json()
    assert len(rows) >= 1
    for row in rows:
        assert isinstance(row, dict)
        assert forbidden.isdisjoint(row.keys()), row

    detail = client.get(f"/api/v1/tasks/{task_id}")
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert isinstance(body, dict)
    assert forbidden.isdisjoint(body.keys()), body


def test_archive_activity_type_nulls_fk_without_deleting_time_log_rows(
    client: TestClient,
) -> None:
    with Session(get_engine()) as session:
        hustle_id = session.exec(
            select(VentureCategoryLabel.id).where(col(VentureCategoryLabel.slug) == "hustle"),
        ).first()
    assert hustle_id is not None

    venture_resp = client.post(
        "/api/v1/ventures",
        json={"name": "Activity archive integration", "category_label_id": hustle_id},
    )
    assert venture_resp.status_code == 201, venture_resp.text
    venture_id = venture_resp.json()["id"]

    project_resp = client.post(
        "/api/v1/projects",
        json={
            "venture_id": venture_id,
            "name": "TL preserve project",
            "colour": "#D97048",
        },
    )
    assert project_resp.status_code == 201, project_resp.text
    project_id = project_resp.json()["id"]

    task_resp = client.post(
        "/api/v1/tasks",
        json={"project_id": project_id, "title": "typed work"},
    )
    assert task_resp.status_code == 201, task_resp.text
    task_id = task_resp.json()["id"]

    activity = client.post("/api/v1/activity-types", json={"name": "integration-focus"})
    assert activity.status_code == 201, activity.text
    activity_id = activity.json()["id"]

    log = client.post(
        f"/api/v1/tasks/{task_id}/time-logs",
        json={
            "hours": 1.5,
            "logged_date": "2026-05-16",
            "activity_type_id": activity_id,
            "notes": "keep this note",
        },
    )
    assert log.status_code == 201, log.text
    log_id = log.json()["id"]

    with Session(get_engine()) as session:
        before_count = len(
            list(session.exec(select(TimeLog).where(TimeLog.task_id == task_id))),
        )
    assert before_count >= 1

    archive = client.patch(f"/api/v1/activity-types/{activity_id}/archive")
    assert archive.status_code in {200, 204}, archive.text

    with Session(get_engine()) as session:
        after_rows = list(session.exec(select(TimeLog).where(TimeLog.id == log_id)))
    assert len(after_rows) == 1
    assert after_rows[0].hours == 1.5
    assert after_rows[0].notes == "keep this note"
    assert after_rows[0].activity_type_id is None

    listed = client.get(f"/api/v1/tasks/{task_id}/time-logs")
    assert listed.status_code == 200, listed.text
    payload = next(row for row in listed.json() if row["id"] == log_id)
    assert payload["activity_type_id"] is None
    assert payload["activity_type_display_name"] == "uncategorised"
