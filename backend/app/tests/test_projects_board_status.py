from __future__ import annotations

from datetime import datetime
from typing import TypedDict, cast
from uuid import uuid4

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
    board_status: str
    finished: bool
    updated_at: str


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
        "name": "Project board card",
        "description": "Used in board-status tests",
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


def test_projects_router_declares_board_status_mutation_endpoint() -> None:
    router_source = (
        "/Users/samjam/Code/momentum-projects-dashboard/backend/app/routers/projects.py"
    )
    with open(router_source, encoding="utf-8") as file:
        source = file.read()
    assert "/{project_id}/board-status" in source
    assert "project_services" in source


@pytest.mark.parametrize("next_status", ["idea", "active", "paused", "shipped"])
def test_patch_board_status_accepts_allowed_statuses(
    client: TestClient,
    next_status: str,
) -> None:
    venture = _create_venture_in_db(f"venture {next_status}")
    project = _create_project(client, venture_id=venture.id, board_status="active")
    before = datetime.fromisoformat(project["updated_at"].replace("Z", "+00:00"))

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}/board-status",
        json={"board_status": next_status, "kanban_order": 4},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["board_status"] == next_status
    assert body["kanban_order"] == 4
    after = datetime.fromisoformat(body["updated_at"].replace("Z", "+00:00"))
    assert after >= before


def test_patch_board_status_rejects_invalid_status(client: TestClient) -> None:
    venture = _create_venture_in_db("invalid status venture")
    project = _create_project(client, venture_id=venture.id)

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}/board-status",
        json={"board_status": "todo"},
    )
    assert response.status_code == 422, response.text


def test_move_to_shipped_defaults_finished_true_without_override(client: TestClient) -> None:
    venture = _create_venture_in_db("shipped default venture")
    project = _create_project(
        client,
        venture_id=venture.id,
        board_status="active",
        finished=False,
    )

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}/board-status",
        json={"board_status": "shipped"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["finished"] is True


def test_move_out_of_shipped_does_not_auto_clear_finished(client: TestClient) -> None:
    venture = _create_venture_in_db("shipped move-out venture")
    project = _create_project(
        client,
        venture_id=venture.id,
        board_status="shipped",
        finished=True,
    )

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}/board-status",
        json={"board_status": "active"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["finished"] is True


def test_patch_board_status_reorders_column_when_order_payload_supplied(client: TestClient) -> None:
    venture = _create_venture_in_db("reorder venture")
    first = _create_project(
        client,
        venture_id=venture.id,
        name="first",
        board_status="active",
        kanban_order=1,
    )
    second = _create_project(
        client,
        venture_id=venture.id,
        name="second",
        board_status="active",
        kanban_order=2,
    )

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{second['id']}/board-status",
        json={
            "board_status": "active",
            "order": [
                {"project_id": second["id"], "kanban_order": 1},
                {"project_id": first["id"], "kanban_order": 2},
            ],
        },
    )
    assert response.status_code == 200, response.text

    first_db = _project_from_db(first["id"])
    second_db = _project_from_db(second["id"])
    assert second_db.kanban_order == 1
    assert first_db.kanban_order == 2


def test_board_status_move_archived_project_returns_conflict(client: TestClient) -> None:
    venture = _create_venture_in_db("archived project venture")
    project = _create_project(client, venture_id=venture.id, board_status="active")
    archive = client.delete(f"{PROJECTS_ENDPOINT}/{project['id']}")
    assert archive.status_code in {200, 204}, archive.text

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}/board-status",
        json={"board_status": "paused"},
    )
    assert response.status_code == 409, response.text


def test_board_status_move_with_archived_parent_venture_returns_conflict(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("archived parent board venture")
    project = _create_project(client, venture_id=venture.id, board_status="active")
    _set_venture_status_in_db(venture.id, "archived")

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{project['id']}/board-status",
        json={"board_status": "paused"},
    )
    assert response.status_code == 409, response.text


def test_project_board_list_order_is_deterministic_by_status_then_order_then_fallback(
    client: TestClient,
) -> None:
    venture = _create_venture_in_db("deterministic order venture")
    shipped = _create_project(
        client,
        venture_id=venture.id,
        name="z shipped",
        board_status="shipped",
        kanban_order=2,
    )
    active_top = _create_project(
        client,
        venture_id=venture.id,
        name="a active top",
        board_status="active",
        kanban_order=1,
    )
    active_bottom = _create_project(
        client,
        venture_id=venture.id,
        name="b active bottom",
        board_status="active",
        kanban_order=2,
    )

    response = client.get(PROJECTS_ENDPOINT, params={"status": "active"})
    assert response.status_code == 200, response.text
    ids = [project["id"] for project in response.json()]
    assert ids.index(active_top["id"]) < ids.index(active_bottom["id"])
    assert ids.index(active_bottom["id"]) < ids.index(shipped["id"])


def test_failed_multicard_order_update_is_transactional(client: TestClient) -> None:
    venture = _create_venture_in_db("transactional order venture")
    first = _create_project(
        client,
        venture_id=venture.id,
        name="first",
        board_status="active",
        kanban_order=1,
    )
    second = _create_project(
        client,
        venture_id=venture.id,
        name="second",
        board_status="active",
        kanban_order=2,
    )

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{second['id']}/board-status",
        json={
            "board_status": "active",
            "order": [
                {"project_id": second["id"], "kanban_order": 1},
                {
                    "project_id": "00000000-0000-0000-0000-000000000000",
                    "kanban_order": 2,
                },
            ],
        },
    )
    assert response.status_code == 422, response.text

    first_db = _project_from_db(first["id"])
    second_db = _project_from_db(second["id"])
    assert first_db.kanban_order == 1
    assert second_db.kanban_order == 2


def test_multicard_order_rejects_projects_outside_target_board_column(client: TestClient) -> None:
    venture = _create_venture_in_db("mixed column rejection venture")
    active = _create_project(
        client,
        venture_id=venture.id,
        name="active card",
        board_status="active",
        kanban_order=1,
    )
    paused = _create_project(
        client,
        venture_id=venture.id,
        name="paused card",
        board_status="paused",
        kanban_order=1,
    )

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{active['id']}/board-status",
        json={
            "board_status": "active",
            "order": [
                {"project_id": active["id"], "kanban_order": 1},
                {"project_id": paused["id"], "kanban_order": 2},
            ],
        },
    )
    assert response.status_code == 422, response.text

    active_db = _project_from_db(active["id"])
    paused_db = _project_from_db(paused["id"])
    assert active_db.kanban_order == 1
    assert paused_db.kanban_order == 1


def test_multicard_order_rejects_projects_outside_scope(client: TestClient) -> None:
    venture_a = _create_venture_in_db("scope venture a")
    venture_b = _create_venture_in_db("scope venture b")
    scoped = _create_project(
        client,
        venture_id=venture_a.id,
        name="scoped",
        board_status="active",
        kanban_order=1,
    )
    unrelated = _create_project(
        client,
        venture_id=venture_b.id,
        name="unrelated",
        board_status="active",
        kanban_order=1,
    )

    response = client.patch(
        f"{PROJECTS_ENDPOINT}/{scoped['id']}/board-status",
        json={
            "board_status": "active",
            "order": [
                {"project_id": scoped["id"], "kanban_order": 1},
                {"project_id": unrelated["id"], "kanban_order": 2},
            ],
        },
    )
    assert response.status_code == 422, response.text

    scoped_db = _project_from_db(scoped["id"])
    unrelated_db = _project_from_db(unrelated["id"])
    assert scoped_db.kanban_order == 1
    assert unrelated_db.kanban_order == 1
