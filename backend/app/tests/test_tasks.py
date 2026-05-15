from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

PROJECTS_ENDPOINT = "/api/v1/projects"
TASKS_ENDPOINT = "/api/v1/tasks"
APP_DIR = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = APP_DIR / "db" / "migrations"
TASKS_ROUTER_FILE = APP_DIR / "routers" / "tasks.py"
TASKS_SERVICE_FILE = APP_DIR / "services" / "tasks.py"


def _assert_is_uuid(value: object) -> None:
    assert isinstance(value, str)
    UUID(value)


def _assert_is_iso8601_timestamp(value: object) -> None:
    assert isinstance(value, str)
    datetime.fromisoformat(value.replace("Z", "+00:00"))


def _utc_today() -> str:
    return datetime.now(UTC).date().isoformat()


def _create_project(
    client: TestClient,
    *,
    name: str = "Phase 1 Project",
    archived: bool = False,
) -> dict[str, object]:
    response = client.post(
        PROJECTS_ENDPOINT,
        json={
            "name": name,
            "description": "Project used by backend task tests.",
            "colour": "#D97048",
        },
    )

    assert response.status_code == 201, response.text
    project = response.json()
    assert isinstance(project, dict)
    if archived:
        archive_response = client.delete(f"{PROJECTS_ENDPOINT}/{project['id']}")
        assert archive_response.status_code in {200, 204}, archive_response.text
    return project


def _create_task(
    client: TestClient,
    *,
    project_id: str,
    title: str = "Ship first kanban slice",
    status: str = "backlog",
    priority: str = "medium",
    estimated_hours: float | None = None,
    target_date: str | None = "2026-05-31",
    kanban_order: int | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "project_id": project_id,
        "title": title,
        "status": status,
        "priority": priority,
    }
    if estimated_hours is not None:
        payload["estimated_hours"] = estimated_hours
    if target_date is not None:
        payload["target_date"] = target_date
    if kanban_order is not None:
        payload["kanban_order"] = kanban_order

    response = client.post(TASKS_ENDPOINT, json=payload)

    assert response.status_code == 201, response.text
    body = response.json()
    assert isinstance(body, dict)
    return body


def _create_manual_time_log(
    client: TestClient,
    task_id: str,
    *,
    hours: float = 1.5,
    logged_date: str = "2026-05-13",
    notes: str = "Focused backend work",
    project_id: str = "00000000-0000-0000-0000-000000000000",
) -> dict[str, object]:
    response = client.post(
        f"{TASKS_ENDPOINT}/{task_id}/time-logs",
        json={
            "hours": hours,
            "logged_date": logged_date,
            "notes": notes,
            "project_id": project_id,
            "source": "toggl",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert isinstance(body, dict)
    return body


def test_tasks_migration_exists_for_phase_1_schema() -> None:
    migration_files = sorted(
        path for path in MIGRATIONS_DIR.rglob("*.py") if path.name != "__init__.py"
    )

    assert migration_files, "Expected Alembic migrations for the tasks and time_logs tables."

    migration_source = "\n".join(path.read_text(encoding="utf-8") for path in migration_files)

    assert "tasks" in migration_source
    assert "time_logs" in migration_source
    for column_name in (
        "project_id",
        "title",
        "status",
        "priority",
        "estimated_hours",
        "actual_hours",
        "target_date",
        "completed_date",
        "kanban_order",
        "hours",
        "logged_date",
        "source",
        "external_id",
        "notes",
    ):
        assert column_name in migration_source


def test_tasks_router_delegates_to_service_layer() -> None:
    assert TASKS_ROUTER_FILE.exists(), "Expected a dedicated tasks router module."
    assert TASKS_SERVICE_FILE.exists(), "Expected a dedicated tasks service module."

    router_source = TASKS_ROUTER_FILE.read_text(encoding="utf-8")

    assert "app.services" in router_source
    assert "tasks" in router_source
    assert "sqlmodel" not in router_source.lower()


def test_create_task_returns_defaults_and_generated_metadata(client: TestClient) -> None:
    project = _create_project(client)

    response = client.post(
        TASKS_ENDPOINT,
        json={
            "project_id": project["id"],
            "title": "Build task service",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()

    _assert_is_uuid(body["id"])
    _assert_is_iso8601_timestamp(body["created_at"])
    _assert_is_iso8601_timestamp(body["updated_at"])
    assert body["project_id"] == project["id"]
    assert body["title"] == "Build task service"
    assert body["status"] == "backlog"
    assert body["priority"] == "medium"
    assert body["actual_hours"] == 0.0
    assert body["completed_date"] is None


@pytest.mark.parametrize("title", ["", "   "])
def test_create_task_rejects_blank_title(client: TestClient, title: str) -> None:
    project = _create_project(client)

    response = client.post(TASKS_ENDPOINT, json={"project_id": project["id"], "title": title})

    assert response.status_code == 422, response.text


@pytest.mark.parametrize("status", ["queued", "in-review"])
def test_create_task_rejects_invalid_status(client: TestClient, status: str) -> None:
    project = _create_project(client)

    response = client.post(
        TASKS_ENDPOINT,
        json={"project_id": project["id"], "title": "Task", "status": status},
    )

    assert response.status_code == 422, response.text


@pytest.mark.parametrize("priority", ["highest", "p2"])
def test_create_task_rejects_invalid_priority(client: TestClient, priority: str) -> None:
    project = _create_project(client)

    response = client.post(
        TASKS_ENDPOINT,
        json={"project_id": project["id"], "title": "Task", "priority": priority},
    )

    assert response.status_code == 422, response.text


def test_create_task_rejects_unknown_or_archived_project(client: TestClient) -> None:
    archived_project = _create_project(client, name="Archived", archived=True)

    missing_response = client.post(
        TASKS_ENDPOINT,
        json={"project_id": "00000000-0000-0000-0000-000000000000", "title": "Task"},
    )
    archived_response = client.post(
        TASKS_ENDPOINT,
        json={"project_id": archived_project["id"], "title": "Task"},
    )

    assert missing_response.status_code == 404, missing_response.text
    assert archived_response.status_code == 409, archived_response.text


def test_create_task_rejects_negative_estimated_hours(client: TestClient) -> None:
    project = _create_project(client)

    response = client.post(
        TASKS_ENDPOINT,
        json={
            "project_id": project["id"],
            "title": "Task",
            "estimated_hours": -1,
        },
    )

    assert response.status_code == 422, response.text


def test_list_tasks_supports_combined_filters(client: TestClient) -> None:
    first_project = _create_project(client, name="First Project")
    second_project = _create_project(client, name="Second Project")
    matching_task = _create_task(
        client,
        project_id=str(first_project["id"]),
        title="Matching task",
        status="review",
        priority="high",
    )
    _create_task(
        client,
        project_id=str(first_project["id"]),
        title="Wrong priority",
        status="review",
        priority="medium",
    )
    _create_task(
        client,
        project_id=str(second_project["id"]),
        title="Wrong project",
        status="review",
        priority="high",
    )

    response = client.get(
        TASKS_ENDPOINT,
        params={
            "project_id": str(first_project["id"]),
            "status": "review",
            "priority": "high",
        },
    )

    assert response.status_code == 200, response.text
    assert [task["id"] for task in response.json()] == [matching_task["id"]]


def test_task_detail_and_list_return_derived_actual_hours(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    _create_manual_time_log(client, str(task["id"]), hours=1.25, notes="First session")
    _create_manual_time_log(client, str(task["id"]), hours=2.75, notes="Second session")

    detail_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}")
    list_response = client.get(TASKS_ENDPOINT, params={"project_id": str(project["id"])})

    assert detail_response.status_code == 200, detail_response.text
    assert list_response.status_code == 200, list_response.text
    assert detail_response.json()["actual_hours"] == 4.0
    assert list_response.json()[0]["actual_hours"] == 4.0


def test_patch_task_updates_editable_fields_but_not_actual_hours(client: TestClient) -> None:
    project = _create_project(client)
    archived_project = _create_project(client, name="Archived", archived=True)
    task = _create_task(client, project_id=str(project["id"]), estimated_hours=1.5)

    _create_manual_time_log(client, str(task["id"]), hours=2.0)

    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}",
        json={
            "title": "Updated title",
            "description": "Updated description",
            "priority": "urgent",
            "status": "review",
            "project_id": archived_project["id"],
            "estimated_hours": 3.0,
            "actual_hours": 99,
        },
    )

    assert response.status_code == 409, response.text

    fallback_project = _create_project(client, name="Fallback")
    success_response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}",
        json={
            "title": "Updated title",
            "description": "Updated description",
            "priority": "urgent",
            "status": "review",
            "project_id": fallback_project["id"],
            "estimated_hours": 3.0,
            "actual_hours": 99,
        },
    )

    assert success_response.status_code == 200, success_response.text
    body = success_response.json()
    assert body["title"] == "Updated title"
    assert body["description"] == "Updated description"
    assert body["priority"] == "urgent"
    assert body["status"] == "review"
    assert body["project_id"] == fallback_project["id"]
    assert body["estimated_hours"] == 3.0
    assert body["actual_hours"] == 2.0


def test_patch_task_rejects_unknown_project(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}",
        json={"project_id": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404, response.text


def test_create_or_update_done_task_sets_completed_date(client: TestClient) -> None:
    project = _create_project(client)

    created_done_task = _create_task(client, project_id=str(project["id"]), status="done")
    assert created_done_task["completed_date"] == _utc_today()

    task = _create_task(client, project_id=str(project["id"]), status="backlog")
    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}",
        json={"status": "done"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["completed_date"] == _utc_today()


def test_status_patch_updates_only_kanban_fields_and_done_semantics(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]), kanban_order=1)

    move_to_done_response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "done", "kanban_order": 4, "title": "Should stay unchanged"},
    )

    assert move_to_done_response.status_code == 200, move_to_done_response.text
    moved_task = move_to_done_response.json()
    assert moved_task["status"] == "done"
    assert moved_task["kanban_order"] == 4
    assert moved_task["completed_date"] == _utc_today()
    assert moved_task["title"] == task["title"]

    same_column_response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "done", "kanban_order": 2},
    )

    assert same_column_response.status_code == 200, same_column_response.text
    assert same_column_response.json()["completed_date"] == _utc_today()

    move_out_response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "review", "kanban_order": 1},
    )

    assert move_out_response.status_code == 200, move_out_response.text
    assert move_out_response.json()["completed_date"] is None


def test_status_patch_rejects_invalid_status(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "blocked", "kanban_order": 2},
    )

    assert response.status_code == 422, response.text


def test_time_logs_are_manual_sorted_and_inherit_project_id(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    first_log = _create_manual_time_log(
        client,
        str(task["id"]),
        hours=1.0,
        logged_date="2026-05-12",
        notes="Older log",
    )
    second_log = _create_manual_time_log(
        client,
        str(task["id"]),
        hours=2.0,
        logged_date="2026-05-13",
        notes="Newer log",
    )
    third_log = _create_manual_time_log(
        client,
        str(task["id"]),
        hours=3.0,
        logged_date="2026-05-13",
        notes="Latest same-day log",
    )

    logs_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}/time-logs")

    assert logs_response.status_code == 200, logs_response.text
    logs = logs_response.json()
    assert [log["id"] for log in logs] == [third_log["id"], second_log["id"], first_log["id"]]
    assert all(log["source"] == "manual" for log in logs)
    assert all(log["project_id"] == project["id"] for log in logs)


def test_delete_time_log_removes_entry_and_updates_actual_hours(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    first_log = _create_manual_time_log(client, str(task["id"]), hours=1.0, notes="First session")
    second_log = _create_manual_time_log(client, str(task["id"]), hours=2.0, notes="Second session")

    delete_response = client.delete(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{first_log['id']}",
    )

    assert delete_response.status_code in {200, 204}, delete_response.text

    logs_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}/time-logs")
    assert logs_response.status_code == 200, logs_response.text
    remaining_ids = [log["id"] for log in logs_response.json()]
    assert first_log["id"] not in remaining_ids
    assert second_log["id"] in remaining_ids

    task_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}")
    assert task_response.status_code == 200, task_response.text
    assert task_response.json()["actual_hours"] == 2.0


def test_time_logs_reject_non_positive_hours_and_missing_task(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    invalid_hours_response = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={"hours": 0, "logged_date": "2026-05-13"},
    )
    missing_task_response = client.post(
        f"{TASKS_ENDPOINT}/00000000-0000-0000-0000-000000000000/time-logs",
        json={"hours": 1, "logged_date": "2026-05-13"},
    )

    assert invalid_hours_response.status_code == 422, invalid_hours_response.text
    assert missing_task_response.status_code == 404, missing_task_response.text


def test_delete_task_removes_task_and_manual_time_logs(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    _create_manual_time_log(client, str(task["id"]), hours=1.0)
    delete_response = client.delete(f"{TASKS_ENDPOINT}/{task['id']}")
    detail_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}")
    logs_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}/time-logs")

    assert delete_response.status_code in {200, 204}, delete_response.text
    assert detail_response.status_code == 404, detail_response.text
    assert logs_response.status_code == 404, logs_response.text


def test_list_tasks_excludes_archived_by_default_and_filters_archived_status(
    client: TestClient,
) -> None:
    project = _create_project(client)
    active_task = _create_task(client, project_id=str(project["id"]), title="Active task")
    archived_task = _create_task(client, project_id=str(project["id"]), title="Archived task")

    archive_response = client.patch(
        f"{TASKS_ENDPOINT}/{archived_task['id']}",
        json={"status": "archived"},
    )
    assert archive_response.status_code == 200, archive_response.text

    active_list_response = client.get(TASKS_ENDPOINT)
    archived_list_response = client.get(f"{TASKS_ENDPOINT}?status=archived")

    assert active_list_response.status_code == 200, active_list_response.text
    assert archived_list_response.status_code == 200, archived_list_response.text

    active_ids = {task["id"] for task in active_list_response.json()}
    archived_ids = {task["id"] for task in archived_list_response.json()}

    assert active_task["id"] in active_ids
    assert archived_task["id"] not in active_ids
    assert archived_ids == {archived_task["id"]}


def test_time_logs_accept_optional_title_and_location(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    response = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={
            "hours": 1.5,
            "logged_date": "2026-05-13",
            "notes": "Captured launch prep",
            "title": "Client call",
            "location": "Home office",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "Client call"
    assert body["location"] == "Home office"
    assert body["notes"] == "Captured launch prep"
