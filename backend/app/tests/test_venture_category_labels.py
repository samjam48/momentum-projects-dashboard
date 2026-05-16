from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db.database import get_engine
from app.models.venture import Venture
from app.models.venture_category_label import VentureCategoryLabel

LABELS_ENDPOINT = "/api/v1/venture-category-labels"
APP_DIR = Path(__file__).resolve().parents[1]
LABELS_ROUTER_FILE = APP_DIR / "routers" / "venture_category_labels.py"
LABELS_SERVICE_FILE = APP_DIR / "services" / "venture_category_labels.py"

SEEDED_LABELS = [
    "Hustle",
    "Business",
    "Investment",
    "Property",
    "Education",
    "Hobby",
]


def _assert_is_uuid(value: object) -> None:
    assert isinstance(value, str)
    UUID(value)


def _assert_is_iso8601_timestamp(value: object) -> None:
    assert isinstance(value, str)
    datetime.fromisoformat(value.replace("Z", "+00:00"))


def _get_label_id_by_name(name: str) -> str:
    with Session(get_engine()) as session:
        label = session.exec(
            select(VentureCategoryLabel).where(VentureCategoryLabel.name == name)
        ).first()
    assert label is not None, f"Expected label {name!r} to exist."
    return label.id


def _create_venture_using_label(label_id: str) -> None:
    venture = Venture(
        id=str(uuid4()),
        name="Label Usage Venture",
        description=None,
        colour="#D97048",
        category_label_id=label_id,
        icon=None,
        status="active",
    )
    with Session(get_engine()) as session:
        session.add(venture)
        session.commit()


def test_venture_category_labels_router_delegates_to_service_layer() -> None:
    assert LABELS_ROUTER_FILE.exists(), "Expected venture category label router module."
    assert LABELS_SERVICE_FILE.exists(), "Expected venture category label service module."

    router_source = LABELS_ROUTER_FILE.read_text(encoding="utf-8")
    assert "app.services" in router_source
    assert "venture_category_labels" in router_source
    assert "sqlmodel" not in router_source.lower()


def test_list_labels_returns_seeded_rows_with_typed_fields_and_deterministic_order(
    client: TestClient,
) -> None:
    response = client.get(LABELS_ENDPOINT)
    assert response.status_code == 200, response.text

    labels = response.json()
    assert isinstance(labels, list)
    assert [label["name"] for label in labels[: len(SEEDED_LABELS)]] == SEEDED_LABELS

    for label in labels:
        assert set(label.keys()) == {
            "id",
            "name",
            "slug",
            "created_at",
            "updated_at",
            "usage_count",
        }
        _assert_is_uuid(label["id"])
        _assert_is_iso8601_timestamp(label["created_at"])
        _assert_is_iso8601_timestamp(label["updated_at"])
        assert isinstance(label["usage_count"], int)

    second_response = client.get(LABELS_ENDPOINT)
    assert second_response.status_code == 200, second_response.text
    assert second_response.json() == labels


def test_create_label_trims_input_and_returns_title_case_name(client: TestClient) -> None:
    response = client.post(LABELS_ENDPOINT, json={"name": "  side hustle  "})
    assert response.status_code == 201, response.text

    label = response.json()
    assert label["name"] == "Side Hustle"
    assert label["slug"] == "side-hustle"
    assert label["usage_count"] == 0
    _assert_is_uuid(label["id"])


@pytest.mark.parametrize("name", ["", "   ", "!!!"])
def test_create_label_rejects_blank_or_punctuation_only_name(
    client: TestClient,
    name: str,
) -> None:
    response = client.post(LABELS_ENDPOINT, json={"name": name})
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("name", ["hustle", " Hustle ", "HUSTLE"])
def test_create_label_enforces_case_insensitive_uniqueness(client: TestClient, name: str) -> None:
    response = client.post(LABELS_ENDPOINT, json={"name": name})
    assert response.status_code == 422, response.text


def test_patch_label_renames_when_unique_and_normalizable(client: TestClient) -> None:
    label_id = _get_label_id_by_name("Business")
    response = client.patch(f"{LABELS_ENDPOINT}/{label_id}", json={"name": " serious work "})
    assert response.status_code == 200, response.text

    label = response.json()
    assert label["id"] == label_id
    assert label["name"] == "Serious Work"
    assert label["slug"] == "serious-work"


@pytest.mark.parametrize("name", ["", "   ", "!!!", "HUSTLE"])
def test_patch_label_rejects_blank_duplicate_or_punctuation_only_name(
    client: TestClient,
    name: str,
) -> None:
    label_id = _get_label_id_by_name("Business")
    response = client.patch(f"{LABELS_ENDPOINT}/{label_id}", json={"name": name})
    assert response.status_code == 422, response.text


def test_patch_label_returns_404_for_unknown_id(client: TestClient) -> None:
    response = client.patch(
        f"{LABELS_ENDPOINT}/00000000-0000-0000-0000-000000000000",
        json={"name": "Renamed"},
    )
    assert response.status_code == 404, response.text


def test_delete_label_hard_deletes_when_unused(client: TestClient) -> None:
    create_response = client.post(LABELS_ENDPOINT, json={"name": "Disposable Label"})
    assert create_response.status_code == 201, create_response.text
    label_id = create_response.json()["id"]

    delete_response = client.delete(f"{LABELS_ENDPOINT}/{label_id}")
    assert delete_response.status_code == 204, delete_response.text

    list_response = client.get(LABELS_ENDPOINT)
    assert list_response.status_code == 200, list_response.text
    ids = {label["id"] for label in list_response.json()}
    assert label_id not in ids


def test_delete_label_rejects_when_in_use_by_venture(client: TestClient) -> None:
    label_id = _get_label_id_by_name("Education")
    _create_venture_using_label(label_id)

    delete_response = client.delete(f"{LABELS_ENDPOINT}/{label_id}")
    assert delete_response.status_code == 422, delete_response.text

    list_response = client.get(LABELS_ENDPOINT)
    assert list_response.status_code == 200, list_response.text
    matching = [label for label in list_response.json() if label["id"] == label_id]
    assert len(matching) == 1
    assert matching[0]["usage_count"] >= 1


def test_delete_label_returns_404_for_unknown_id(client: TestClient) -> None:
    response = client.delete(f"{LABELS_ENDPOINT}/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404, response.text
