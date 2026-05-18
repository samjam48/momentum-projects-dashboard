from __future__ import annotations

from datetime import datetime
from typing import TypedDict, cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db.database import get_engine
from app.models.project import Project
from app.models.venture import Venture
from app.models.venture_category_label import VentureCategoryLabel

PROJECTS_ENDPOINT = "/api/v1/projects"


class _ProjectResponse(TypedDict):
    id: str


def _assert_is_uuid(value: object) -> None:
    assert isinstance(value, str)
    UUID(value)


def _assert_is_iso8601_timestamp(value: object) -> None:
    assert isinstance(value, str)
    datetime.fromisoformat(value.replace("Z", "+00:00"))


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


def _create_project(
    client: TestClient,
    venture_id: str,
    **overrides: object,
) -> _ProjectResponse:
    payload: dict[str, object] = {
        "venture_id": venture_id,
        "name": "Phase 1.6 Project",
        "description": "Project for 1.6-4 tests",
        "colour": "#D97048",
    }
    payload.update(overrides)
    response = client.post(PROJECTS_ENDPOINT, json=payload)
    assert response.status_code == 201, response.text
    return cast(_ProjectResponse, response.json())


def _project_from_db(project_id: str) -> Project:
    with Session(get_engine()) as session:
        project = session.get(Project, project_id)
    assert project is not None
    return project


def _set_venture_status_in_db(venture_id: str, status: str) -> None:
    with Session(get_engine()) as session:
        venture = session.get(Venture, venture_id)
        assert venture is not None
        venture.status = status
        session.add(venture)
        session.commit()


def test_create_project_requires_valid_active_venture(client: TestClient) -> None:
    archived_venture = _create_venture_in_db("Archived venture", status="archived")

    missing_venture_id_response = client.post(
        PROJECTS_ENDPOINT,
        json={"name": "No venture id"},
    )
    unknown_venture_response = client.post(
        PROJECTS_ENDPOINT,
        json={"venture_id": "00000000-0000-0000-0000-000000000000", "name": "Unknown venture"},
    )
    archived_venture_response = client.post(
        PROJECTS_ENDPOINT,
        json={"venture_id": archived_venture.id, "name": "Archived venture owner"},
    )

    assert missing_venture_id_response.status_code == 422, missing_venture_id_response.text
    assert unknown_venture_response.status_code == 404, unknown_venture_response.text
    assert archived_venture_response.status_code in {404, 409}, archived_venture_response.text


def test_create_project_accepts_type_board_status_icon_and_returns_extended_read_fields(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("Active venture")

    response = client.post(
        PROJECTS_ENDPOINT,
        json={
            "venture_id": venture.id,
            "name": "Contract launch",
            "project_type": "contract",
            "board_status": "idea",
            "icon": "rocket",
            "finished": False,
            "archived_by_venture": False,
        },
    )
    assert response.status_code == 201, response.text

    body = response.json()
    _assert_is_uuid(body["id"])
    _assert_is_iso8601_timestamp(body["created_at"])
    _assert_is_iso8601_timestamp(body["updated_at"])
    assert body["venture_id"] == venture.id
    assert body["project_type"] == "contract"
    assert body["board_status"] == "idea"
    assert body["icon"] == "rocket"
    assert body["status"] == "active"
    assert body["finished"] is False
    assert body["archived_by_venture"] is False


@pytest.mark.parametrize("project_type", ["invalid", "PROJECT"])
def test_create_project_rejects_invalid_project_type(
    client: TestClient,
    project_type: str,
) -> None:
    venture = _create_venture_in_db(f"Venture {project_type}")
    response = client.post(
        PROJECTS_ENDPOINT,
        json={"venture_id": venture.id, "name": "Bad type", "project_type": project_type},
    )
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("board_status", ["todo", "ACTIVE"])
def test_create_project_rejects_invalid_board_status(
    client: TestClient,
    board_status: str,
) -> None:
    venture = _create_venture_in_db(f"Venture {board_status}")
    response = client.post(
        PROJECTS_ENDPOINT,
        json={"venture_id": venture.id, "name": "Bad board", "board_status": board_status},
    )
    assert response.status_code == 422, response.text


def test_update_project_requires_valid_active_venture_when_venture_changes(
    client: TestClient,
) -> None:
    owner = _create_venture_in_db("Owner venture")
    archived_target = _create_venture_in_db("Archived target", status="archived")
    project = _create_project(client, venture_id=owner.id, name="Move me")

    unknown = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}",
        json={"venture_id": "00000000-0000-0000-0000-000000000000"},
    )
    archived = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}",
        json={"venture_id": archived_target.id},
    )

    assert unknown.status_code == 404, unknown.text
    assert archived.status_code in {404, 409}, archived.text


def test_list_projects_supports_compound_filters_status_venture_type_board_and_finished(
    client: TestClient,
) -> None:
    venture_a = _create_venture_in_db("Venture A")
    venture_b = _create_venture_in_db("Venture B")

    matching = _create_project(
        client,
        venture_id=venture_a.id,
        name="Matching",
        project_type="gig",
        board_status="paused",
        finished=True,
    )
    _create_project(
        client,
        venture_id=venture_a.id,
        name="Wrong board",
        project_type="gig",
        board_status="active",
        finished=True,
    )
    _create_project(
        client,
        venture_id=venture_b.id,
        name="Wrong venture",
        project_type="gig",
        board_status="paused",
        finished=True,
    )

    response = client.get(
        PROJECTS_ENDPOINT,
        params={
            "status": "active",
            "venture_id": venture_a.id,
            "project_type": "gig",
            "board_status": "paused",
            "finished": "true",
        },
    )
    assert response.status_code == 200, response.text
    ids = [project["id"] for project in response.json()]
    assert ids == [matching["id"]]


def test_archive_project_defaults_finished_true_when_board_status_is_shipped(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("Shipping venture")
    project = _create_project(
        client,
        venture_id=venture.id,
        name="Shipped project",
        board_status="shipped",
        finished=False,
    )

    archive = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive.status_code in {200, 204}, archive.text

    detail = client.get(f"{PROJECTS_ENDPOINT}/{project['id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["status"] == "archived"
    assert detail.json()["finished"] is True


def test_archive_project_respects_explicit_finished_override(client: TestClient) -> None:
    venture = _create_venture_in_db("Archive override venture")
    shipped_project = _create_project(
        client,
        venture_id=venture.id,
        name="Shipped with explicit false",
        board_status="shipped",
        finished=False,
    )
    active_project = _create_project(
        client,
        venture_id=venture.id,
        name="Active with explicit true",
        board_status="active",
        finished=False,
    )

    archive_shipped = client.post(
        f"{PROJECTS_ENDPOINT}/{shipped_project['id']}/archive",
        json={"finished": False},
    )
    assert archive_shipped.status_code in {200, 204}, archive_shipped.text
    shipped_detail = client.get(f"{PROJECTS_ENDPOINT}/{shipped_project['id']}")
    assert shipped_detail.status_code == 200, shipped_detail.text
    assert shipped_detail.json()["finished"] is False

    archive_active = client.post(
        f"{PROJECTS_ENDPOINT}/{active_project['id']}/archive",
        json={"finished": True},
    )
    assert archive_active.status_code in {200, 204}, archive_active.text
    active_detail = client.get(f"{PROJECTS_ENDPOINT}/{active_project['id']}")
    assert active_detail.status_code == 200, active_detail.text
    assert active_detail.json()["finished"] is True


def test_archive_project_under_active_venture_does_not_set_archived_by_venture(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("Active parent")
    project = _create_project(client, venture_id=venture.id, name="Direct archive")

    archive = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive.status_code in {200, 204}, archive.text

    stored = _project_from_db(str(project["id"]))
    assert stored.status == "archived"
    assert stored.archived_by_venture is False


def test_create_project_ignores_client_archived_by_venture_input(client: TestClient) -> None:
    venture = _create_venture_in_db("Read-only archived flag venture")
    response = client.post(
        PROJECTS_ENDPOINT,
        json={
            "venture_id": venture.id,
            "name": "Archived flag ignored",
            "archived_by_venture": True,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["archived_by_venture"] is False


def test_unarchive_project_restores_active_and_clears_archived_by_venture(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("Unarchive parent")
    project = _create_project(
        client,
        venture_id=venture.id,
        name="Needs unarchive",
        archived_by_venture=True,
    )
    archive = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive.status_code in {200, 204}, archive.text

    unarchive = client.patch(f"{PROJECTS_ENDPOINT}/{project['id']}/unarchive")
    assert unarchive.status_code == 200, unarchive.text
    body = unarchive.json()
    assert body["status"] == "active"
    assert body["archived_by_venture"] is False


def test_unarchive_blocked_when_parent_venture_archived(client: TestClient) -> None:
    venture = _create_venture_in_db("Archived parent candidate")
    project = _create_project(client, venture_id=venture.id, name="Blocked unarchive")
    archive = client.post(f"{PROJECTS_ENDPOINT}/{project['id']}/archive")
    assert archive.status_code in {200, 204}, archive.text
    _set_venture_status_in_db(venture.id, "archived")

    unarchive = client.patch(f"{PROJECTS_ENDPOINT}/{project['id']}/unarchive")
    assert unarchive.status_code == 409, unarchive.text


def test_delete_project_no_longer_archives_project(client: TestClient) -> None:
    venture = _create_venture_in_db("Delete alias removed")
    project = _create_project(client, venture_id=venture.id, name="DELETE should not archive")

    delete_response = client.delete(f"{PROJECTS_ENDPOINT}/{project['id']}")
    assert delete_response.status_code == 405, delete_response.text

    detail = client.get(f"{PROJECTS_ENDPOINT}/{project['id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["status"] == "active"
