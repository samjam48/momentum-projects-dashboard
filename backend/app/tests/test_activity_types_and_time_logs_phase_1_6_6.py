from __future__ import annotations

from typing import TypedDict, cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db.database import get_engine
from app.models.activity_type import ActivityType
from app.models.project import Project
from app.models.task import Task
from app.models.venture import Venture
from app.models.venture_category_label import VentureCategoryLabel

TASKS_ENDPOINT = "/api/v1/tasks"
ACTIVITY_TYPES_ENDPOINT = "/api/v1/activity-types"


class _EntityId(TypedDict):
    id: str


def _label_id(name: str = "Hustle") -> str:
    with Session(get_engine()) as session:
        label = session.exec(
            select(VentureCategoryLabel).where(VentureCategoryLabel.name == name)
        ).first()
    assert label is not None
    return label.id


def _create_venture_in_db(name: str, status: str = "active") -> Venture:
    venture = Venture(
        id=str(uuid4()),
        name=name,
        description=None,
        colour="#D97048",
        category_label_id=_label_id("Hustle"),
        icon=None,
        status=status,
    )
    with Session(get_engine()) as session:
        session.add(venture)
        session.commit()
        session.refresh(venture)
    return venture


def _create_project(client: TestClient, venture_id: str, name: str) -> _EntityId:
    response = client.post(
        "/api/v1/projects",
        json={
            "venture_id": venture_id,
            "name": name,
            "description": "Project for activity type tests",
            "colour": "#D97048",
        },
    )
    assert response.status_code == 201, response.text
    return cast(_EntityId, response.json())


def _create_task(client: TestClient, project_id: str, title: str) -> _EntityId:
    response = client.post(
        TASKS_ENDPOINT,
        json={
            "project_id": project_id,
            "title": title,
        },
    )
    assert response.status_code == 201, response.text
    return cast(_EntityId, response.json())


def _create_activity_type_in_db(name: str, status: str = "active") -> ActivityType:
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


def _time_log_activity_type_id(task_id: str) -> str | None:
    with Session(get_engine()) as session:
        task = session.get(Task, task_id)
        assert task is not None
        time_log = session.exec(select(Project, Task).where(Task.id == task.id)).first()
        assert time_log is not None
    with Session(get_engine()) as session:
        row = session.exec(
            select(Task.id, Task.project_id).where(Task.id == task_id)
        ).first()
        assert row is not None
        project_id = row[1]
        from app.models.time_log import TimeLog

        log = session.exec(
            select(TimeLog)
            .where(TimeLog.task_id == task_id)
            .where(TimeLog.project_id == project_id)
            .order_by(TimeLog.created_at.desc())
        ).first()
    assert log is not None
    return log.activity_type_id


def test_activity_types_router_and_service_modules_exist() -> None:
    router_path = (
        "/Users/samjam/Code/momentum-projects-dashboard/backend/app/routers/activity_types.py"
    )
    service_path = (
        "/Users/samjam/Code/momentum-projects-dashboard/backend/app/services/activity_types.py"
    )
    schema_path = (
        "/Users/samjam/Code/momentum-projects-dashboard/backend/app/schemas/activity_type.py"
    )
    with open(router_path, encoding="utf-8") as _:
        pass
    with open(service_path, encoding="utf-8") as _:
        pass
    with open(schema_path, encoding="utf-8") as _:
        pass


def test_list_activity_types_defaults_to_active_and_supports_archived_filter(
    client: TestClient,
) -> None:
    default_response = client.get(ACTIVITY_TYPES_ENDPOINT)
    archived_response = client.get(ACTIVITY_TYPES_ENDPOINT, params={"status": "archived"})

    assert default_response.status_code == 200, default_response.text
    assert archived_response.status_code == 200, archived_response.text
    assert [item["name"] for item in default_response.json()[:3]] == [
        "planning",
        "meeting",
        "admin",
    ]


def test_create_activity_type_trims_and_validates_uniqueness_reserved_and_max_length(
    client: TestClient,
) -> None:
    created = client.post(ACTIVITY_TYPES_ENDPOINT, json={"name": "  Deep Work  "})
    duplicate = client.post(ACTIVITY_TYPES_ENDPOINT, json={"name": " deep work "})
    reserved = client.post(ACTIVITY_TYPES_ENDPOINT, json={"name": "Uncategorised"})
    too_long = client.post(ACTIVITY_TYPES_ENDPOINT, json={"name": "x" * 26})

    assert created.status_code == 201, created.text
    assert created.json()["name"] == "Deep Work"
    assert created.json()["slug"] == "deep-work"
    assert duplicate.status_code == 422, duplicate.text
    assert reserved.status_code == 422, reserved.text
    assert too_long.status_code == 422, too_long.text


def test_patch_activity_type_supports_rename_with_same_validation_rules(
    client: TestClient,
) -> None:
    created = client.post(ACTIVITY_TYPES_ENDPOINT, json={"name": "Focus"})
    assert created.status_code == 201, created.text
    activity_type_id = created.json()["id"]

    renamed = client.patch(
        f"{ACTIVITY_TYPES_ENDPOINT}/{activity_type_id}",
        json={"name": "Planning Session"},
    )
    duplicate = client.patch(
        f"{ACTIVITY_TYPES_ENDPOINT}/{activity_type_id}",
        json={"name": "planning"},
    )
    too_long = client.patch(
        f"{ACTIVITY_TYPES_ENDPOINT}/{activity_type_id}",
        json={"name": "x" * 26},
    )

    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Planning Session"
    assert renamed.json()["slug"] == "planning-session"
    assert duplicate.status_code == 422, duplicate.text
    assert too_long.status_code == 422, too_long.text


def test_delete_activity_type_rejects_when_used_and_returns_404_for_unknown_id(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("activity type delete venture")
    project = _create_project(client, venture.id, "delete guard project")
    task = _create_task(client, project["id"], "task with typed log")
    activity_type = _create_activity_type_in_db("analysis")

    create_log = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={
            "hours": 1.5,
            "logged_date": "2026-05-15",
            "activity_type_id": activity_type.id,
            "notes": "typed log",
        },
    )
    assert create_log.status_code == 201, create_log.text

    used_delete = client.delete(f"{ACTIVITY_TYPES_ENDPOINT}/{activity_type.id}")
    unknown_delete = client.delete(
        f"{ACTIVITY_TYPES_ENDPOINT}/00000000-0000-0000-0000-000000000000"
    )

    assert used_delete.status_code == 422, used_delete.text
    assert unknown_delete.status_code == 404, unknown_delete.text


def test_archive_activity_type_clears_time_log_references_and_is_idempotent(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("archive activity type venture")
    project = _create_project(client, venture.id, "archive fk project")
    task = _create_task(client, project["id"], "task to clear fk")
    activity_type = _create_activity_type_in_db("sync up")

    create_log = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={
            "hours": 2.0,
            "logged_date": "2026-05-15",
            "activity_type_id": activity_type.id,
        },
    )
    assert create_log.status_code == 201, create_log.text

    archive_once = client.patch(f"{ACTIVITY_TYPES_ENDPOINT}/{activity_type.id}/archive")
    archive_twice = client.patch(f"{ACTIVITY_TYPES_ENDPOINT}/{activity_type.id}/archive")

    assert archive_once.status_code in {200, 204}, archive_once.text
    assert archive_twice.status_code in {200, 204}, archive_twice.text
    assert _time_log_activity_type_id(task["id"]) is None


def test_create_time_log_accepts_optional_activity_type_and_rejects_unknown_or_archived(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("time log activity type venture")
    project = _create_project(client, venture.id, "time log project")
    task = _create_task(client, project["id"], "time log task")
    active_activity_type = _create_activity_type_in_db("research")
    archived_activity_type = _create_activity_type_in_db("ops", status="archived")

    no_type = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={"hours": 1.0, "logged_date": "2026-05-15"},
    )
    with_type = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={
            "hours": 1.5,
            "logged_date": "2026-05-15",
            "activity_type_id": active_activity_type.id,
        },
    )
    unknown = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={
            "hours": 2.0,
            "logged_date": "2026-05-15",
            "activity_type_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    archived = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={
            "hours": 2.0,
            "logged_date": "2026-05-15",
            "activity_type_id": archived_activity_type.id,
        },
    )

    assert no_type.status_code == 201, no_type.text
    assert with_type.status_code == 201, with_type.text
    assert unknown.status_code == 422, unknown.text
    assert archived.status_code == 422, archived.text


def test_time_log_reads_include_activity_type_fields_and_uncategorised_display(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("time log display venture")
    project = _create_project(client, venture.id, "display project")
    task = _create_task(client, project["id"], "display task")
    activity_type = _create_activity_type_in_db("deep admin")

    typed_log = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={
            "hours": 1.25,
            "logged_date": "2026-05-15",
            "activity_type_id": activity_type.id,
        },
    )
    assert typed_log.status_code == 201, typed_log.text

    untyped_log = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={"hours": 0.5, "logged_date": "2026-05-15"},
    )
    assert untyped_log.status_code == 201, untyped_log.text

    logs_response = client.get(f"{TASKS_ENDPOINT}/{task['id']}/time-logs")
    assert logs_response.status_code == 200, logs_response.text
    logs = logs_response.json()

    typed_row = next(log for log in logs if log["id"] == typed_log.json()["id"])
    untyped_row = next(log for log in logs if log["id"] == untyped_log.json()["id"])

    assert typed_row["activity_type_id"] == activity_type.id
    assert typed_row["activity_type_name"] == "deep admin"
    assert typed_row["activity_type_display_name"] == "deep admin"
    assert untyped_row["activity_type_id"] is None
    assert untyped_row["activity_type_name"] is None
    assert untyped_row["activity_type_display_name"] == "uncategorised"
