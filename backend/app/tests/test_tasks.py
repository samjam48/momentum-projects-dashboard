from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db.database import get_engine
from app.models.activity_type import ActivityType
from app.models.time_log import TimeLog

from .venture_test_utils import create_active_venture_in_db

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
    venture_id = create_active_venture_in_db()
    response = client.post(
        PROJECTS_ENDPOINT,
        json={
            "venture_id": venture_id,
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


def _create_activity_type(*, name: str, status: str = "active") -> ActivityType:
    activity_type = ActivityType(
        id=str(uuid4()),
        name=name,
        slug=name.strip().lower().replace(" ", "-"),
        status=status,
    )
    with Session(get_engine()) as session:
        session.add(activity_type)
        session.commit()
        session.refresh(activity_type)
    return activity_type


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


def test_status_patch_restores_archived_task_to_backlog_when_project_active(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]), title="Archived row")

    archive_task = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}",
        json={"status": "archived"},
    )
    assert archive_task.status_code == 200, archive_task.text

    restore = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "backlog", "kanban_order": None},
    )
    assert restore.status_code == 200, restore.text
    restored = restore.json()
    assert restored["status"] == "backlog"


def test_status_patch_blocks_restoring_archived_task_when_project_archived(
    client: TestClient,
) -> None:
    project = _create_project(client, name="Archived parent")
    task = _create_task(client, project_id=str(project["id"]), title="Stranded task")

    archive_task = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}",
        json={"status": "archived"},
    )
    assert archive_task.status_code == 200, archive_task.text

    archive_project = client.delete(f"{PROJECTS_ENDPOINT}/{project['id']}")
    assert archive_project.status_code in {200, 204}, archive_project.text

    blocked = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "backlog"},
    )
    assert blocked.status_code == 409, blocked.text


def test_status_patch_blocks_restoring_archived_task_when_parent_venture_archived(
    client: TestClient,
) -> None:
    project = _create_project(client, name="Cascade project")
    venture_id = project["venture_id"]
    task = _create_task(client, project_id=str(project["id"]), title="Venture cascade task")

    archive_task = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}",
        json={"status": "archived"},
    )
    assert archive_task.status_code == 200, archive_task.text

    archive_venture = client.delete(f"/api/v1/ventures/{venture_id}")
    assert archive_venture.status_code in {200, 204}, archive_venture.text

    blocked = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "backlog"},
    )
    assert blocked.status_code == 409, blocked.text


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


def test_list_time_logs_and_actual_hours_exclude_archived_rows(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    active_log = _create_manual_time_log(
        client,
        str(task["id"]),
        hours=1.25,
        logged_date="2026-05-12",
        notes="Active row",
    )
    archived_log = _create_manual_time_log(
        client,
        str(task["id"]),
        hours=2.75,
        logged_date="2026-05-13",
        notes="Will be archived",
    )

    with Session(get_engine()) as session:
        archived_row = session.get(TimeLog, archived_log["id"])
        assert archived_row is not None
        archived_row.status = "archived"
        session.add(archived_row)
        session.commit()
        session.refresh(archived_row)
        assert archived_row.task_id == task["id"]
        assert archived_row.status == "archived"

    recompute_response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{active_log['id']}",
        json={"notes": "Recompute active-only totals"},
    )
    assert recompute_response.status_code == 200, recompute_response.text

    logs_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}/time-logs")
    assert logs_response.status_code == 200, logs_response.text
    logs = logs_response.json()
    assert [log["id"] for log in logs] == [active_log["id"]]

    detail_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}")
    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["actual_hours"] == 1.25

    list_response = client.get(TASKS_ENDPOINT, params={"project_id": project["id"]})
    assert list_response.status_code == 200, list_response.text
    listed_task = next(item for item in list_response.json() if item["id"] == task["id"])
    assert listed_task["actual_hours"] == 1.25


def test_delete_time_log_removes_entry_and_updates_actual_hours(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    first_log = _create_manual_time_log(client, str(task["id"]), hours=1.0, notes="First session")
    second_log = _create_manual_time_log(client, str(task["id"]), hours=2.0, notes="Second session")

    delete_response = client.delete(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{first_log['id']}",
    )

    assert delete_response.status_code == 204, delete_response.text

    logs_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}/time-logs")
    assert logs_response.status_code == 200, logs_response.text
    remaining_ids = [log["id"] for log in logs_response.json()]
    assert first_log["id"] not in remaining_ids
    assert second_log["id"] in remaining_ids

    task_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}")
    assert task_response.status_code == 200, task_response.text
    assert task_response.json()["actual_hours"] == 2.0

    with Session(get_engine()) as session:
        deleted_row = session.exec(select(TimeLog).where(TimeLog.id == first_log["id"])).first()
    assert deleted_row is None


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


def test_delete_task_archives_child_time_logs_and_removes_task(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    first_log = _create_manual_time_log(client, str(task["id"]), hours=1.0)
    second_log = _create_manual_time_log(client, str(task["id"]), hours=2.0)
    delete_response = client.delete(f"{TASKS_ENDPOINT}/{task['id']}")
    detail_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}")
    logs_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}/time-logs")

    assert delete_response.status_code == 204, delete_response.text
    assert detail_response.status_code == 404, detail_response.text
    assert logs_response.status_code == 404, logs_response.text

    with Session(get_engine()) as session:
        first_row = session.exec(select(TimeLog).where(TimeLog.id == first_log["id"])).first()
        second_row = session.exec(select(TimeLog).where(TimeLog.id == second_log["id"])).first()

    assert first_row is not None
    assert second_row is not None
    assert first_row.task_id is None
    assert second_row.task_id is None
    assert getattr(first_row, "status", None) == "archived"
    assert getattr(second_row, "status", None) == "archived"
    assert first_row.project_id == project["id"]
    assert second_row.project_id == project["id"]


def test_delete_task_with_zero_time_logs_still_returns_no_content(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    delete_response = client.delete(f"{TASKS_ENDPOINT}/{task['id']}")

    assert delete_response.status_code == 204, delete_response.text


def test_delete_task_succeeds_when_parent_project_archived(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))

    archive_project = client.delete(f"{PROJECTS_ENDPOINT}/{project['id']}")
    assert archive_project.status_code in {200, 204}, archive_project.text

    delete_response = client.delete(f"{TASKS_ENDPOINT}/{task['id']}")
    assert delete_response.status_code == 204, delete_response.text


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


def test_patch_time_log_updates_fields_and_recomputes_actual_hours(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))
    first_log = _create_manual_time_log(
        client,
        str(task["id"]),
        hours=1.0,
        logged_date="2026-05-10",
    )
    _create_manual_time_log(client, str(task["id"]), hours=2.0, logged_date="2026-05-11")

    patch_response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{first_log['id']}",
        json={
            "hours": 3.0,
            "logged_date": "2026-05-12",
            "notes": "Updated notes",
            "title": "Deep work block",
            "location": "Remote",
            "activity_type_id": None,
        },
    )

    assert patch_response.status_code == 200, patch_response.text
    body = patch_response.json()
    assert body["hours"] == 3.0
    assert body["logged_date"] == "2026-05-12"
    assert body["notes"] == "Updated notes"
    assert body["title"] == "Deep work block"
    assert body["location"] == "Remote"
    assert body["activity_type_id"] is None
    assert body["activity_type_display_name"] == "uncategorised"

    task_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}")
    assert task_response.status_code == 200, task_response.text
    assert task_response.json()["actual_hours"] == 5.0


def test_patch_time_log_sets_activity_type_when_valid(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))
    unique = uuid4().hex[:8]
    activity_type = _create_activity_type(name=f"planning-{unique}")
    time_log = _create_manual_time_log(client, str(task["id"]), hours=1.0)

    patch_response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{time_log['id']}",
        json={"activity_type_id": activity_type.id},
    )

    assert patch_response.status_code == 200, patch_response.text
    patched = patch_response.json()
    assert patched["activity_type_id"] == activity_type.id
    assert patched["activity_type_name"] == activity_type.name
    assert patched["hours"] == 1.0


def test_patch_time_log_rejects_unknown_or_archived_activity_type(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))
    archived = _create_activity_type(name=f"archived-type-{uuid4().hex[:8]}", status="archived")
    time_log = _create_manual_time_log(client, str(task["id"]), hours=1.0)

    unknown = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{time_log['id']}",
        json={"activity_type_id": "00000000-0000-4000-8000-000000000001"},
    )
    bad_archived = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{time_log['id']}",
        json={"activity_type_id": archived.id},
    )

    assert unknown.status_code == 422, unknown.text
    assert bad_archived.status_code == 422, bad_archived.text


def test_patch_time_log_returns_404_for_wrong_task_or_missing_entry(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task_a = _create_task(client, project_id=str(project["id"]), title="Task A")
    task_b = _create_task(client, project_id=str(project["id"]), title="Task B")
    time_log = _create_manual_time_log(client, str(task_a["id"]), hours=1.0)

    wrong_task = client.patch(
        f"{TASKS_ENDPOINT}/{task_b['id']}/time-logs/{time_log['id']}",
        json={"hours": 2.0},
    )
    missing = client.patch(
        f"{TASKS_ENDPOINT}/{task_a['id']}/time-logs/00000000-0000-4000-8000-000000000099",
        json={"hours": 2.0},
    )

    assert wrong_task.status_code == 404, wrong_task.text
    assert missing.status_code == 404, missing.text


def test_patch_time_log_requires_at_least_one_field(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))
    time_log = _create_manual_time_log(client, str(task["id"]), hours=1.0)

    empty = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{time_log['id']}",
        json={},
    )

    assert empty.status_code == 422, empty.text


def test_patch_time_log_rejects_non_positive_hours(client: TestClient) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=str(project["id"]))
    time_log = _create_manual_time_log(client, str(task["id"]), hours=1.0)

    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{time_log['id']}",
        json={"hours": 0},
    )

    assert response.status_code == 422, response.text
