from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

TASKS_ENDPOINT = "/api/v1/tasks"
PROJECTS_ENDPOINT = "/api/v1/projects"
VENTURES_ENDPOINT = "/api/v1/ventures"
ACTIVITY_TYPES_ENDPOINT = "/api/v1/activity-types"
LABELS_ENDPOINT = "/api/v1/venture-category-labels"


def _list_label_rows(client: TestClient) -> list[dict[str, Any]]:
    response = client.get(LABELS_ENDPOINT)
    assert response.status_code == 200, response.text
    rows = response.json()
    assert isinstance(rows, list)
    return rows


def _label_id_by_name(client: TestClient, name: str) -> str:
    for row in _list_label_rows(client):
        if row["name"] == name:
            return str(row["id"])
    pytest.fail(f"Expected seeded venture category label {name!r}.")


def _create_venture(
    client: TestClient,
    *,
    name: str,
    category_label_id: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"name": name}
    if category_label_id is not None:
        payload["category_label_id"] = category_label_id
    response = client.post(VENTURES_ENDPOINT, json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert isinstance(body, dict)
    return body


def _create_project(
    client: TestClient,
    *,
    venture_id: str,
    name: str,
) -> dict[str, Any]:
    response = client.post(
        PROJECTS_ENDPOINT,
        json={
            "venture_id": venture_id,
            "name": name,
            "description": "phase-f pagination fixture",
            "colour": "#D97048",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert isinstance(body, dict)
    return body


def _create_task(
    client: TestClient,
    *,
    project_id: str,
    title: str,
    status: str = "backlog",
    priority: str = "medium",
) -> dict[str, Any]:
    response = client.post(
        TASKS_ENDPOINT,
        json={
            "project_id": project_id,
            "title": title,
            "status": status,
            "priority": priority,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert isinstance(body, dict)
    return body


def _create_activity_type(client: TestClient, name: str) -> dict[str, Any]:
    response = client.post(ACTIVITY_TYPES_ENDPOINT, json={"name": name})
    assert response.status_code == 201, response.text
    body = response.json()
    assert isinstance(body, dict)
    return body


def _assert_paginated_shape(body: object) -> tuple[list[dict[str, Any]], str | None]:
    assert isinstance(body, dict), "Expected paginated wrapper object."
    assert set(body) == {"items", "next_cursor"}
    assert isinstance(body["items"], list)
    next_cursor = body["next_cursor"]
    assert next_cursor is None or isinstance(next_cursor, str)
    return body["items"], next_cursor


@pytest.mark.parametrize(
    "endpoint,params",
    [
        (TASKS_ENDPOINT, {}),
        (PROJECTS_ENDPOINT, {}),
        (VENTURES_ENDPOINT, {}),
        (ACTIVITY_TYPES_ENDPOINT, {}),
        (LABELS_ENDPOINT, {}),
    ],
)
def test_list_endpoints_without_limit_keep_array_shape(
    client: TestClient,
    endpoint: str,
    params: dict[str, str],
) -> None:
    response = client.get(endpoint, params=params)
    assert response.status_code == 200, response.text
    assert isinstance(response.json(), list)


def test_tasks_list_supports_opt_in_cursor_pagination_with_filters(client: TestClient) -> None:
    venture = _create_venture(client, name="Phase F Tasks Venture")
    project = _create_project(client, venture_id=str(venture["id"]), name="Tasks Target Project")
    other_project = _create_project(
        client,
        venture_id=str(venture["id"]),
        name="Tasks Other Project",
    )

    target_ids = {
        str(_create_task(client, project_id=str(project["id"]), title="Task A")["id"]),
        str(_create_task(client, project_id=str(project["id"]), title="Task B")["id"]),
        str(_create_task(client, project_id=str(project["id"]), title="Task C")["id"]),
    }
    _create_task(
        client,
        project_id=str(project["id"]),
        title="Task D Done",
        status="done",
        priority="high",
    )
    _create_task(client, project_id=str(other_project["id"]), title="Task Outside Filter")

    params = {"project_id": str(project["id"]), "status": "backlog", "priority": "medium"}
    list_response = client.get(TASKS_ENDPOINT, params=params)
    assert list_response.status_code == 200, list_response.text
    assert isinstance(list_response.json(), list)

    first_page = client.get(TASKS_ENDPOINT, params={**params, "limit": 2})
    assert first_page.status_code == 200, first_page.text
    first_items, first_cursor = _assert_paginated_shape(first_page.json())
    assert len(first_items) == 2
    assert first_cursor is not None
    first_ids = {str(item["id"]) for item in first_items}
    assert first_ids <= target_ids

    second_page = client.get(
        TASKS_ENDPOINT,
        params={**params, "limit": 2, "cursor": first_cursor},
    )
    assert second_page.status_code == 200, second_page.text
    second_items, second_cursor = _assert_paginated_shape(second_page.json())
    assert len(second_items) == 1
    assert second_cursor is None
    second_ids = {str(item["id"]) for item in second_items}
    assert second_ids <= target_ids
    assert first_ids.isdisjoint(second_ids)
    assert first_ids | second_ids == target_ids


def test_projects_list_supports_opt_in_cursor_pagination_with_filters(client: TestClient) -> None:
    venture_a = _create_venture(client, name="Phase F Projects Venture A")
    venture_b = _create_venture(client, name="Phase F Projects Venture B")

    first = _create_project(client, venture_id=str(venture_a["id"]), name="Project A1")
    second = _create_project(client, venture_id=str(venture_a["id"]), name="Project A2")
    third = _create_project(client, venture_id=str(venture_a["id"]), name="Project A3")
    _create_project(client, venture_id=str(venture_b["id"]), name="Project B1")

    target_ids = {str(first["id"]), str(second["id"]), str(third["id"])}
    params = {"venture_id": str(venture_a["id"]), "status": "active"}
    list_response = client.get(PROJECTS_ENDPOINT, params=params)
    assert list_response.status_code == 200, list_response.text
    unpaginated_items = list_response.json()
    assert isinstance(unpaginated_items, list)
    unpaginated_ids = [str(item["id"]) for item in unpaginated_items]

    first_page = client.get(PROJECTS_ENDPOINT, params={**params, "limit": 2})
    assert first_page.status_code == 200, first_page.text
    first_items, first_cursor = _assert_paginated_shape(first_page.json())
    assert len(first_items) == 2
    assert first_cursor is not None
    first_ids = {str(item["id"]) for item in first_items}
    assert first_ids <= target_ids

    second_page = client.get(
        PROJECTS_ENDPOINT,
        params={**params, "limit": 2, "cursor": first_cursor},
    )
    assert second_page.status_code == 200, second_page.text
    second_items, second_cursor = _assert_paginated_shape(second_page.json())
    assert len(second_items) == 1
    assert second_cursor is None
    second_ids = {str(item["id"]) for item in second_items}
    assert second_ids <= target_ids
    assert first_ids.isdisjoint(second_ids)
    assert first_ids | second_ids == target_ids
    combined_paginated_ids = [str(item["id"]) for item in first_items + second_items]
    assert combined_paginated_ids == unpaginated_ids


def test_ventures_list_supports_opt_in_cursor_pagination_with_filters(client: TestClient) -> None:
    business_id = _label_id_by_name(client, "Business")
    hustle_id = _label_id_by_name(client, "Hustle")

    first = _create_venture(client, name="Business Venture A", category_label_id=business_id)
    second = _create_venture(client, name="Business Venture B", category_label_id=business_id)
    third = _create_venture(client, name="Business Venture C", category_label_id=business_id)
    _create_venture(client, name="Hustle Venture D", category_label_id=hustle_id)

    target_ids = {str(first["id"]), str(second["id"]), str(third["id"])}
    params = {"status": "active", "category_label_id": business_id}
    list_response = client.get(VENTURES_ENDPOINT, params=params)
    assert list_response.status_code == 200, list_response.text
    assert isinstance(list_response.json(), list)

    first_page = client.get(VENTURES_ENDPOINT, params={**params, "limit": 2})
    assert first_page.status_code == 200, first_page.text
    first_items, first_cursor = _assert_paginated_shape(first_page.json())
    assert len(first_items) == 2
    assert first_cursor is not None
    first_ids = {str(item["id"]) for item in first_items}
    assert first_ids <= target_ids

    second_page = client.get(
        VENTURES_ENDPOINT,
        params={**params, "limit": 2, "cursor": first_cursor},
    )
    assert second_page.status_code == 200, second_page.text
    second_items, second_cursor = _assert_paginated_shape(second_page.json())
    assert len(second_items) == 1
    assert second_cursor is None
    second_ids = {str(item["id"]) for item in second_items}
    assert second_ids <= target_ids
    assert first_ids.isdisjoint(second_ids)
    assert first_ids | second_ids == target_ids


def test_activity_types_list_supports_opt_in_cursor_pagination_with_status_filter(
    client: TestClient,
) -> None:
    first = _create_activity_type(client, "PhaseF Arch A")
    second = _create_activity_type(client, "PhaseF Arch B")

    archive_first = client.patch(f"{ACTIVITY_TYPES_ENDPOINT}/{first['id']}/archive")
    archive_second = client.patch(f"{ACTIVITY_TYPES_ENDPOINT}/{second['id']}/archive")
    assert archive_first.status_code in {200, 204}, archive_first.text
    assert archive_second.status_code in {200, 204}, archive_second.text

    target_ids = {str(first["id"]), str(second["id"])}
    params = {"status": "archived"}
    list_response = client.get(ACTIVITY_TYPES_ENDPOINT, params=params)
    assert list_response.status_code == 200, list_response.text
    unpaginated_items = list_response.json()
    assert isinstance(unpaginated_items, list)
    unpaginated_ids = [str(item["id"]) for item in unpaginated_items]

    first_page = client.get(ACTIVITY_TYPES_ENDPOINT, params={**params, "limit": 1})
    assert first_page.status_code == 200, first_page.text
    first_items, first_cursor = _assert_paginated_shape(first_page.json())
    assert len(first_items) == 1
    assert first_cursor is not None
    first_ids = {str(item["id"]) for item in first_items}
    assert first_ids <= target_ids

    second_page = client.get(
        ACTIVITY_TYPES_ENDPOINT,
        params={**params, "limit": 1, "cursor": first_cursor},
    )
    assert second_page.status_code == 200, second_page.text
    second_items, second_cursor = _assert_paginated_shape(second_page.json())
    assert len(second_items) == 1
    assert second_cursor is None
    second_ids = {str(item["id"]) for item in second_items}
    assert second_ids <= target_ids
    assert first_ids.isdisjoint(second_ids)
    assert first_ids | second_ids == target_ids
    combined_paginated_ids = [str(item["id"]) for item in first_items + second_items]
    assert combined_paginated_ids == unpaginated_ids


def test_labels_list_supports_opt_in_cursor_pagination(client: TestClient) -> None:
    list_response = client.get(LABELS_ENDPOINT)
    assert list_response.status_code == 200, list_response.text
    unpaginated_items = list_response.json()
    assert isinstance(unpaginated_items, list)
    unpaginated_ids = [str(item["id"]) for item in unpaginated_items]

    first_page = client.get(LABELS_ENDPOINT, params={"limit": 3})
    assert first_page.status_code == 200, first_page.text
    first_items, first_cursor = _assert_paginated_shape(first_page.json())
    assert len(first_items) == 3
    assert first_cursor is not None

    second_page = client.get(LABELS_ENDPOINT, params={"limit": 3, "cursor": first_cursor})
    assert second_page.status_code == 200, second_page.text
    second_items, second_cursor = _assert_paginated_shape(second_page.json())
    assert len(second_items) >= 1
    assert second_cursor is None or isinstance(second_cursor, str)
    combined_paginated_ids = [str(item["id"]) for item in first_items + second_items]
    assert combined_paginated_ids == unpaginated_ids


@pytest.mark.parametrize(
    "endpoint",
    [
        TASKS_ENDPOINT,
        PROJECTS_ENDPOINT,
        VENTURES_ENDPOINT,
        ACTIVITY_TYPES_ENDPOINT,
        LABELS_ENDPOINT,
    ],
)
def test_paginated_list_endpoints_validate_limit_bounds(
    client: TestClient,
    endpoint: str,
) -> None:
    zero_limit = client.get(endpoint, params={"limit": 0})
    over_limit = client.get(endpoint, params={"limit": 501})

    assert zero_limit.status_code == 422, zero_limit.text
    assert over_limit.status_code == 422, over_limit.text


def test_cursor_requires_limit_and_invalid_cursor_is_rejected(client: TestClient) -> None:
    venture = _create_venture(client, name="Cursor Validation Venture")
    project = _create_project(
        client,
        venture_id=str(venture["id"]),
        name="Cursor Validation Project",
    )
    _create_task(client, project_id=str(project["id"]), title="Cursor Validation Task")

    cursor_without_limit = client.get(
        TASKS_ENDPOINT,
        params={"project_id": str(project["id"]), "cursor": "invalid-cursor"},
    )
    invalid_cursor_with_limit = client.get(
        TASKS_ENDPOINT,
        params={"project_id": str(project["id"]), "limit": 2, "cursor": "invalid-cursor"},
    )

    assert cursor_without_limit.status_code == 422, cursor_without_limit.text
    assert invalid_cursor_with_limit.status_code in {400, 422}, invalid_cursor_with_limit.text


def test_task_time_logs_list_remains_unpaginated_when_limit_and_cursor_are_supplied(
    client: TestClient,
) -> None:
    venture = _create_venture(client, name="Time Log Pagination Deferred Venture")
    project = _create_project(
        client,
        venture_id=str(venture["id"]),
        name="Time Log Pagination Deferred",
    )
    task = _create_task(client, project_id=str(project["id"]), title="Task With Logs")

    create_log = client.post(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        json={"hours": 1.25, "logged_date": "2026-05-18"},
    )
    assert create_log.status_code == 201, create_log.text

    response = client.get(
        f"{TASKS_ENDPOINT}/{task['id']}/time-logs",
        params={"limit": 1, "cursor": "ignored-for-now"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 1
