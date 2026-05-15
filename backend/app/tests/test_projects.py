from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from .venture_test_utils import create_active_venture_in_db

PROJECTS_ENDPOINT = "/api/v1/projects"
APP_DIR = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = APP_DIR / "db" / "migrations"
PROJECTS_ROUTER_FILE = APP_DIR / "routers" / "projects.py"
PROJECTS_SERVICE_FILE = APP_DIR / "services" / "projects.py"


def _assert_is_uuid(value: object) -> None:
    assert isinstance(value, str)
    UUID(value)


def _assert_is_iso8601_timestamp(value: object) -> None:
    assert isinstance(value, str)
    datetime.fromisoformat(value.replace("Z", "+00:00"))


def _create_project(client: TestClient, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "Phase 1 Project",
        "description": "Project used by backend CRUD tests.",
        "colour": "#D97048",
    }
    payload.update(overrides)
    if "venture_id" not in payload:
        payload["venture_id"] = create_active_venture_in_db()

    response = client.post(PROJECTS_ENDPOINT, json=payload)

    assert response.status_code == 201, response.text
    body = response.json()
    assert isinstance(body, dict)
    return body


def test_projects_migration_exists_for_phase_1_schema() -> None:
    migration_files = sorted(
        path for path in MIGRATIONS_DIR.rglob("*.py") if path.name != "__init__.py"
    )

    assert migration_files, "Expected an Alembic migration for the projects table."

    migration_source = "\n".join(path.read_text(encoding="utf-8") for path in migration_files)

    assert "projects" in migration_source
    for column_name in (
        "id",
        "name",
        "description",
        "colour",
        "status",
        "created_at",
        "updated_at",
    ):
        assert column_name in migration_source


def test_projects_router_delegates_to_service_layer() -> None:
    assert PROJECTS_ROUTER_FILE.exists(), "Expected a dedicated projects router module."
    assert PROJECTS_SERVICE_FILE.exists(), "Expected a dedicated projects service module."

    router_source = PROJECTS_ROUTER_FILE.read_text(encoding="utf-8")

    assert "app.services" in router_source
    assert "projects" in router_source
    assert "sqlmodel" not in router_source.lower()


def test_create_project_returns_active_project_with_generated_metadata(
    client: TestClient,
) -> None:
    venture_id = create_active_venture_in_db("Venture for create metadata test")
    response = client.post(
        PROJECTS_ENDPOINT,
        json={
            "venture_id": venture_id,
            "name": "Momentum Phase 1",
            "description": "Projects CRUD and archive",
            "colour": "#D97048",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()

    assert body["name"] == "Momentum Phase 1"
    assert body["description"] == "Projects CRUD and archive"
    assert body["colour"] == "#D97048"
    assert body["venture_id"] == venture_id
    assert body["status"] == "active"
    _assert_is_uuid(body["id"])
    _assert_is_iso8601_timestamp(body["created_at"])
    _assert_is_iso8601_timestamp(body["updated_at"])


@pytest.mark.parametrize("name", ["", "   "])
def test_create_project_rejects_blank_name(client: TestClient, name: str) -> None:
    venture_id = create_active_venture_in_db()
    response = client.post(PROJECTS_ENDPOINT, json={"name": name, "venture_id": venture_id})

    assert response.status_code == 422, response.text


@pytest.mark.parametrize("colour", ["D97048", "#FFF", "#12GG45", "#1234567"])
def test_create_project_rejects_invalid_colour(client: TestClient, colour: str) -> None:
    venture_id = create_active_venture_in_db()
    response = client.post(
        PROJECTS_ENDPOINT,
        json={"name": "Valid Name", "colour": colour, "venture_id": venture_id},
    )

    assert response.status_code == 422, response.text


def test_list_projects_defaults_to_active_and_supports_status_filter(
    client: TestClient,
) -> None:
    active_project = _create_project(client, name="Active Project")
    archived_project = _create_project(client, name="Archived Project")

    archive_response = client.delete(f"{PROJECTS_ENDPOINT}/{archived_project['id']}")
    assert archive_response.status_code in {200, 204}, archive_response.text

    default_response = client.get(PROJECTS_ENDPOINT)
    active_response = client.get(PROJECTS_ENDPOINT, params={"status": "active"})
    archived_response = client.get(PROJECTS_ENDPOINT, params={"status": "archived"})

    assert default_response.status_code == 200, default_response.text
    assert active_response.status_code == 200, active_response.text
    assert archived_response.status_code == 200, archived_response.text

    assert [project["id"] for project in default_response.json()] == [active_project["id"]]
    assert [project["id"] for project in active_response.json()] == [active_project["id"]]
    assert [project["id"] for project in archived_response.json()] == [archived_project["id"]]


def test_get_project_by_id_returns_archived_projects(client: TestClient) -> None:
    project = _create_project(client, name="Project To Archive")

    archive_response = client.delete(f"{PROJECTS_ENDPOINT}/{project['id']}")
    assert archive_response.status_code in {200, 204}, archive_response.text

    detail_response = client.get(f"{PROJECTS_ENDPOINT}/{project['id']}")

    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["status"] == "archived"


def test_get_project_by_id_returns_404_for_unknown_project(client: TestClient) -> None:
    _create_project(client, name="Existing Project")

    response = client.get(f"{PROJECTS_ENDPOINT}/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404, response.text


def test_patch_project_updates_only_editable_fields(client: TestClient) -> None:
    project = _create_project(client)

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}",
        json={
            "name": "Renamed Project",
            "description": "Updated description",
            "colour": "#123ABC",
            "id": "11111111-1111-1111-1111-111111111111",
            "status": "archived",
            "created_at": "2000-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()

    assert body["id"] == project["id"]
    assert body["created_at"] == project["created_at"]
    assert body["status"] == "active"
    assert body["name"] == "Renamed Project"
    assert body["description"] == "Updated description"
    assert body["colour"] == "#123ABC"
    assert body["updated_at"] != project["updated_at"]


@pytest.mark.parametrize("name", ["", "   "])
def test_patch_project_rejects_blank_name(client: TestClient, name: str) -> None:
    project = _create_project(client)

    response = client.patch(f"{PROJECTS_ENDPOINT}/{project['id']}", json={"name": name})

    assert response.status_code == 422, response.text


@pytest.mark.parametrize("colour", ["123456", "#12345", "#XYZ123"])
def test_patch_project_rejects_invalid_colour(client: TestClient, colour: str) -> None:
    project = _create_project(client)

    response = client.patch(f"{PROJECTS_ENDPOINT}/{project['id']}", json={"colour": colour})

    assert response.status_code == 422, response.text


def test_patch_archived_project_returns_conflict(client: TestClient) -> None:
    project = _create_project(client)

    archive_response = client.delete(f"{PROJECTS_ENDPOINT}/{project['id']}")
    assert archive_response.status_code in {200, 204}, archive_response.text

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}",
        json={"name": "Should Not Update"},
    )

    assert response.status_code == 409, response.text


def test_delete_project_soft_archives_and_is_idempotent(client: TestClient) -> None:
    project = _create_project(client)

    first_delete = client.delete(f"{PROJECTS_ENDPOINT}/{project['id']}")
    second_delete = client.delete(f"{PROJECTS_ENDPOINT}/{project['id']}")
    detail_response = client.get(f"{PROJECTS_ENDPOINT}/{project['id']}")

    assert first_delete.status_code in {200, 204}, first_delete.text
    assert second_delete.status_code in {200, 204}, second_delete.text
    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["status"] == "archived"
    assert detail_response.json()["updated_at"] != project["updated_at"]


def test_delete_project_returns_404_for_unknown_project(client: TestClient) -> None:
    _create_project(client, name="Existing Project")

    response = client.delete(f"{PROJECTS_ENDPOINT}/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404, response.text
