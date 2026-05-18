from __future__ import annotations

from typing import TypedDict, cast

from fastapi.testclient import TestClient

from .venture_test_utils import create_active_venture_in_db

PROJECTS_ENDPOINT = "/api/v1/projects"
TASKS_ENDPOINT = "/api/v1/tasks"
VENTURES_ENDPOINT = "/api/v1/ventures"
ARCHIVED_PROJECT_DETAIL = "Archived projects cannot accept task changes."
ARCHIVED_VENTURE_DETAIL = "Projects under archived ventures cannot accept task changes."


class _ProjectResponse(TypedDict):
    id: str
    venture_id: str | None


class _TaskResponse(TypedDict):
    id: str


class _TimeLogResponse(TypedDict):
    id: str


def _create_project(
    client: TestClient,
    *,
    name: str = "Archive matrix project",
    archived: bool = False,
) -> _ProjectResponse:
    venture_id = create_active_venture_in_db()
    response = client.post(
        PROJECTS_ENDPOINT,
        json={
            "venture_id": venture_id,
            "name": name,
            "description": "Project used by archive mutation matrix tests.",
            "colour": "#D97048",
        },
    )
    assert response.status_code == 201, response.text
    project = cast(_ProjectResponse, response.json())
    if archived:
        archive_response = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
        assert archive_response.status_code in {200, 204}, archive_response.text
    return project


def _create_task(
    client: TestClient,
    *,
    project_id: str,
    status: str = "backlog",
) -> _TaskResponse:
    response = client.post(
        TASKS_ENDPOINT,
        json={
            "project_id": project_id,
            "title": "Guard matrix task",
            "status": status,
        },
    )
    assert response.status_code == 201, response.text
    return cast(_TaskResponse, response.json())


def _create_time_log(client: TestClient, *, task_id: str, hours: float = 1.0) -> _TimeLogResponse:
    response = client.post(
        f"{TASKS_ENDPOINT}/{task_id}/time-logs",
        json={
            "hours": hours,
            "logged_date": "2026-05-18",
        },
    )
    assert response.status_code == 201, response.text
    return cast(_TimeLogResponse, response.json())


def test_archive_matrix_active_project_create_task_allows_mutation(client: TestClient) -> None:
    project = _create_project(client)

    response = client.post(
        TASKS_ENDPOINT,
        json={
            "project_id": project["id"],
            "title": "Create task on active project",
        },
    )

    assert response.status_code == 201, response.text


def test_archive_matrix_archived_project_create_task_blocks_with_conflict(
    client: TestClient,
) -> None:
    project = _create_project(client, archived=True)

    response = client.post(
        TASKS_ENDPOINT,
        json={
            "project_id": project["id"],
            "title": "Create task on archived project",
        },
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"] == ARCHIVED_PROJECT_DETAIL


def test_archive_matrix_archived_project_patch_task_blocks_with_conflict(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=project["id"])
    archive_project = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive_project.status_code in {200, 204}, archive_project.text

    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}",
        json={"title": "Should fail on archived parent"},
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"] == ARCHIVED_PROJECT_DETAIL


def test_archive_matrix_archived_project_status_patch_blocks_with_conflict(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=project["id"])
    archive_project = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive_project.status_code in {200, 204}, archive_project.text

    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "in_progress"},
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"] == ARCHIVED_PROJECT_DETAIL


def test_archive_matrix_archived_project_create_time_log_blocks_with_conflict(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=project["id"])
    archive_project = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive_project.status_code in {200, 204}, archive_project.text

    response = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={"hours": 1.0, "logged_date": "2026-05-18"},
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"] == ARCHIVED_PROJECT_DETAIL


def test_archive_matrix_archived_project_patch_time_log_blocks_with_conflict(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=project["id"])
    time_log = _create_time_log(client, task_id=task["id"])
    archive_project = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive_project.status_code in {200, 204}, archive_project.text

    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{time_log['id']}",
        json={"notes": "Should fail on archived parent"},
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"] == ARCHIVED_PROJECT_DETAIL


def test_archive_matrix_venture_archived_status_patch_blocks_with_conflict(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=project["id"])
    venture_id = project["venture_id"]
    assert venture_id is not None
    archive_venture = client.post(f"{VENTURES_ENDPOINT}/{venture_id}/archive")
    assert archive_venture.status_code in {200, 204}, archive_venture.text

    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "in_progress"},
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"] == ARCHIVED_VENTURE_DETAIL


def test_archive_matrix_active_project_status_patch_allows_mutation(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=project["id"])

    response = client.patch(
        f"{TASKS_ENDPOINT}/{task['id']}/status",
        json={"status": "in_progress"},
    )

    assert response.status_code == 200, response.text


def test_delete_task_returns_204_even_when_parent_project_archived(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=project["id"])
    archive_project = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive_project.status_code in {200, 204}, archive_project.text

    response = client.delete(f"{TASKS_ENDPOINT}/{task['id']}")

    assert response.status_code == 204, response.text


def test_delete_time_log_returns_204_even_when_parent_project_archived(
    client: TestClient,
) -> None:
    project = _create_project(client)
    task = _create_task(client, project_id=project["id"])
    time_log = _create_time_log(client, task_id=task["id"])
    archive_project = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive_project.status_code in {200, 204}, archive_project.text

    response = client.delete(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs/{time_log['id']}",
    )

    assert response.status_code == 204, response.text
