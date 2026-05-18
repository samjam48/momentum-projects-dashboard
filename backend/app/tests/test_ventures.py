from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import TypedDict, cast
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db.database import get_engine
from app.models.project import Project
from app.models.venture import Venture
from app.models.venture_category_label import VentureCategoryLabel

VENTURES_ENDPOINT = "/api/v1/ventures"
APP_DIR = Path(__file__).resolve().parents[1]
VENTURES_ROUTER_FILE = APP_DIR / "routers" / "ventures.py"
VENTURES_SERVICE_FILE = APP_DIR / "services" / "ventures.py"


class _ProjectResponse(TypedDict):
    id: str


def _assert_is_uuid(value: object) -> None:
    assert isinstance(value, str)
    UUID(value)


def _assert_is_iso8601_timestamp(value: object) -> None:
    assert isinstance(value, str)
    datetime.fromisoformat(value.replace("Z", "+00:00"))


def _get_label_id(name: str) -> str:
    with Session(get_engine()) as session:
        label = session.exec(
            select(VentureCategoryLabel).where(VentureCategoryLabel.name == name)
        ).first()
    assert label is not None
    return label.id


def _get_venture_from_db(venture_id: str) -> Venture:
    with Session(get_engine()) as session:
        venture = session.get(Venture, venture_id)
    assert venture is not None
    return venture


def _get_projects_for_venture(venture_id: str) -> list[Project]:
    with Session(get_engine()) as session:
        projects = list(
            session.exec(select(Project).where(Project.venture_id == venture_id))
        )
    return projects


def _create_project(
    client: TestClient,
    venture_id: str,
    name: str,
    status: str = "active",
) -> _ProjectResponse:
    response = client.post(
        "/api/v1/projects",
        json={
            "venture_id": venture_id,
            "name": name,
            "description": "project for venture cascade tests",
            "colour": "#D97048",
            "status": status,
        },
    )
    assert response.status_code == 201, response.text
    return cast(_ProjectResponse, response.json())


def test_ventures_router_delegates_to_service_layer() -> None:
    assert VENTURES_ROUTER_FILE.exists(), "Expected ventures router module."
    assert VENTURES_SERVICE_FILE.exists(), "Expected ventures service module."

    router_source = VENTURES_ROUTER_FILE.read_text(encoding="utf-8")
    assert "app.services" in router_source
    assert "ventures" in router_source
    assert "sqlmodel" not in router_source.lower()


def test_create_venture_accepts_all_supported_fields(client: TestClient) -> None:
    response = client.post(
        VENTURES_ENDPOINT,
        json={
            "name": " Consulting ",
            "description": "Client work",
            "colour": "#D97048",
            "category_label_id": _get_label_id("Business"),
            "icon": "briefcase",
        },
    )
    assert response.status_code == 201, response.text
    venture = response.json()

    assert venture["name"] == "Consulting"
    assert venture["description"] == "Client work"
    assert venture["colour"] == "#D97048"
    assert venture["icon"] == "briefcase"
    assert venture["status"] == "active"
    _assert_is_uuid(venture["id"])
    _assert_is_iso8601_timestamp(venture["created_at"])
    _assert_is_iso8601_timestamp(venture["updated_at"])


def test_create_venture_defaults_category_label_to_hustle_when_omitted(
    client: TestClient,
) -> None:
    response = client.post(
        VENTURES_ENDPOINT,
        json={
            "name": "Default Label Venture",
            "description": None,
            "colour": "#D97048",
        },
    )
    assert response.status_code == 201, response.text
    venture = response.json()
    assert venture["category_label"]["name"] == "Hustle"
    assert venture["category_label"]["slug"] == "hustle"


@pytest.mark.parametrize("name", ["", "   "])
def test_create_venture_rejects_blank_name(client: TestClient, name: str) -> None:
    response = client.post(VENTURES_ENDPOINT, json={"name": name})
    assert response.status_code == 422, response.text


def test_create_venture_rejects_non_palette_colour(client: TestClient) -> None:
    response = client.post(
        VENTURES_ENDPOINT,
        json={"name": "Invalid Colour Venture", "colour": "#000000"},
    )
    assert response.status_code == 422, response.text


def test_create_venture_rejects_unknown_category_label_id(client: TestClient) -> None:
    response = client.post(
        VENTURES_ENDPOINT,
        json={
            "name": "Unknown Label Venture",
            "category_label_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    assert response.status_code == 404, response.text


def test_list_ventures_defaults_to_active_and_supports_archived_filter(
    client: TestClient,
) -> None:
    active = client.post(VENTURES_ENDPOINT, json={"name": "Active Venture"})
    archived = client.post(VENTURES_ENDPOINT, json={"name": "Archived Venture"})
    assert active.status_code == 201, active.text
    assert archived.status_code == 201, archived.text

    archive_response = client.post(f"{VENTURES_ENDPOINT}/{archived.json()['id']}/archive")
    assert archive_response.status_code in {200, 204}, archive_response.text

    default_response = client.get(VENTURES_ENDPOINT)
    active_response = client.get(VENTURES_ENDPOINT, params={"status": "active"})
    archived_response = client.get(VENTURES_ENDPOINT, params={"status": "archived"})

    assert default_response.status_code == 200, default_response.text
    assert active_response.status_code == 200, active_response.text
    assert archived_response.status_code == 200, archived_response.text

    default_ids = {venture["id"] for venture in default_response.json()}
    active_ids = {venture["id"] for venture in active_response.json()}
    archived_ids = {venture["id"] for venture in archived_response.json()}

    assert active.json()["id"] in default_ids
    assert active.json()["id"] in active_ids
    assert archived.json()["id"] in archived_ids
    assert archived.json()["id"] not in default_ids


def test_list_ventures_supports_category_label_filter(client: TestClient) -> None:
    hustle_id = _get_label_id("Hustle")
    business_id = _get_label_id("Business")

    hustle_response = client.post(
        VENTURES_ENDPOINT,
        json={"name": "Hustle Venture", "category_label_id": hustle_id},
    )
    business_response = client.post(
        VENTURES_ENDPOINT,
        json={"name": "Business Venture", "category_label_id": business_id},
    )
    assert hustle_response.status_code == 201, hustle_response.text
    assert business_response.status_code == 201, business_response.text

    filtered = client.get(VENTURES_ENDPOINT, params={"category_label_id": business_id})
    assert filtered.status_code == 200, filtered.text
    ids = {venture["id"] for venture in filtered.json()}
    assert business_response.json()["id"] in ids
    assert hustle_response.json()["id"] not in ids


def test_get_venture_detail_returns_category_label_data(client: TestClient) -> None:
    response = client.post(VENTURES_ENDPOINT, json={"name": "Detail Venture"})
    assert response.status_code == 201, response.text
    venture_id = response.json()["id"]

    detail = client.get(f"{VENTURES_ENDPOINT}/{venture_id}")
    assert detail.status_code == 200, detail.text
    body = detail.json()

    assert body["id"] == venture_id
    assert "category_label" in body
    assert set(body["category_label"].keys()) >= {"id", "name", "slug"}


def test_get_venture_returns_404_for_unknown_id(client: TestClient) -> None:
    response = client.get(f"{VENTURES_ENDPOINT}/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404, response.text


def test_patch_venture_updates_supported_fields(client: TestClient) -> None:
    create_response = client.post(VENTURES_ENDPOINT, json={"name": "Before Update"})
    assert create_response.status_code == 201, create_response.text
    venture_id = create_response.json()["id"]

    response = client.patch(
        f"{VENTURES_ENDPOINT}/{venture_id}",
        json={
            "name": "  After Update  ",
            "description": "updated",
            "colour": "#D97048",
            "category_label_id": _get_label_id("Investment"),
            "icon": "rocket",
        },
    )
    assert response.status_code == 200, response.text
    venture = response.json()
    assert venture["name"] == "After Update"
    assert venture["description"] == "updated"
    assert venture["colour"] == "#D97048"
    assert venture["icon"] == "rocket"
    assert venture["category_label"]["name"] == "Investment"


def test_patch_venture_rejects_blank_name(client: TestClient) -> None:
    create_response = client.post(VENTURES_ENDPOINT, json={"name": "Update Guard Venture"})
    assert create_response.status_code == 201, create_response.text
    venture_id = create_response.json()["id"]

    response = client.patch(f"{VENTURES_ENDPOINT}/{venture_id}", json={"name": "   "})
    assert response.status_code == 422, response.text


def test_patch_venture_rejects_unknown_category_label_id(client: TestClient) -> None:
    create_response = client.post(VENTURES_ENDPOINT, json={"name": "Update Category Venture"})
    assert create_response.status_code == 201, create_response.text
    venture_id = create_response.json()["id"]

    response = client.patch(
        f"{VENTURES_ENDPOINT}/{venture_id}",
        json={"category_label_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert response.status_code == 404, response.text


def test_patch_archived_venture_returns_conflict(client: TestClient) -> None:
    create_response = client.post(VENTURES_ENDPOINT, json={"name": "Archive Me"})
    assert create_response.status_code == 201, create_response.text
    venture_id = create_response.json()["id"]
    archive_response = client.post(f"{VENTURES_ENDPOINT}/{venture_id}/archive")
    assert archive_response.status_code in {200, 204}, archive_response.text

    patch_response = client.patch(
        f"{VENTURES_ENDPOINT}/{venture_id}",
        json={"name": "Should Not Apply"},
    )
    assert patch_response.status_code == 409, patch_response.text


def test_archive_venture_archives_active_child_projects_and_marks_cascade_flag(
    client: TestClient,
) -> None:
    create_response = client.post(VENTURES_ENDPOINT, json={"name": "Cascade Venture"})
    assert create_response.status_code == 201, create_response.text
    venture_id = create_response.json()["id"]

    active_child = _create_project(client, venture_id=venture_id, name="Active Child")
    archived_child = _create_project(
        client,
        venture_id=venture_id,
        name="Already Archived Child",
    )
    archive_direct = client.post(f"/api/v1/projects/{archived_child['id']}/archive")
    assert archive_direct.status_code in {200, 204}, archive_direct.text

    archive_response = client.post(f"{VENTURES_ENDPOINT}/{venture_id}/archive")
    assert archive_response.status_code in {200, 204}, archive_response.text

    venture = _get_venture_from_db(venture_id)
    assert venture.status == "archived"

    projects = {project.id: project for project in _get_projects_for_venture(venture_id)}
    assert projects[str(active_child["id"])].status == "archived"
    assert projects[str(active_child["id"])].archived_by_venture is True
    assert projects[str(archived_child["id"])].status == "archived"
    assert projects[str(archived_child["id"])].archived_by_venture is False


def test_archive_venture_is_idempotent(client: TestClient) -> None:
    create_response = client.post(VENTURES_ENDPOINT, json={"name": "Idempotent Archive"})
    assert create_response.status_code == 201, create_response.text
    venture_id = create_response.json()["id"]

    first = client.post(f"{VENTURES_ENDPOINT}/{venture_id}/archive")
    second = client.post(f"{VENTURES_ENDPOINT}/{venture_id}/archive")

    assert first.status_code in {200, 204}, first.text
    assert second.status_code in {200, 204}, second.text


def test_unarchive_venture_restores_only_projects_archived_by_venture(client: TestClient) -> None:
    create_response = client.post(VENTURES_ENDPOINT, json={"name": "Restore Venture"})
    assert create_response.status_code == 201, create_response.text
    venture_id = create_response.json()["id"]

    cascade_child = _create_project(client, venture_id=venture_id, name="Cascade Child")
    archived_before = _create_project(client, venture_id=venture_id, name="Manual Archived Child")
    archive_direct = client.post(f"/api/v1/projects/{archived_before['id']}/archive")
    assert archive_direct.status_code in {200, 204}, archive_direct.text

    archive_response = client.post(f"{VENTURES_ENDPOINT}/{venture_id}/archive")
    assert archive_response.status_code in {200, 204}, archive_response.text

    restore_response = client.patch(f"{VENTURES_ENDPOINT}/{venture_id}/unarchive")
    assert restore_response.status_code == 200, restore_response.text

    venture = _get_venture_from_db(venture_id)
    assert venture.status == "active"

    projects = {project.id: project for project in _get_projects_for_venture(venture_id)}
    assert projects[str(cascade_child["id"])].status == "active"
    assert projects[str(cascade_child["id"])].archived_by_venture is False
    assert projects[str(archived_before["id"])].status == "archived"
    assert projects[str(archived_before["id"])].archived_by_venture is False


def test_unarchive_active_venture_is_idempotent(client: TestClient) -> None:
    create_response = client.post(VENTURES_ENDPOINT, json={"name": "Already Active"})
    assert create_response.status_code == 201, create_response.text
    venture_id = create_response.json()["id"]

    response = client.patch(f"{VENTURES_ENDPOINT}/{venture_id}/unarchive")
    assert response.status_code in {200, 204}, response.text


def test_delete_venture_no_longer_archives_venture(client: TestClient) -> None:
    create_response = client.post(VENTURES_ENDPOINT, json={"name": "Delete alias removed"})
    assert create_response.status_code == 201, create_response.text
    venture_id = create_response.json()["id"]

    delete_response = client.delete(f"{VENTURES_ENDPOINT}/{venture_id}")
    assert delete_response.status_code == 405, delete_response.text

    detail_response = client.get(f"{VENTURES_ENDPOINT}/{venture_id}")
    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["status"] == "active"
