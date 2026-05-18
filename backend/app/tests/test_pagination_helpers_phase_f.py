from __future__ import annotations

import importlib
import inspect
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from types import ModuleType
from typing import cast

import pytest
from fastapi import HTTPException
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, col, create_engine, select
from sqlmodel.sql.expression import SelectOfScalar

from app.models.activity_type import ActivityType

EncodeCursor = Callable[[Sequence[str]], str]
DecodeCursor = Callable[[str], tuple[str, ...]]
ApplyCursorLimit = Callable[
    [SelectOfScalar[ActivityType], int, str | None, Sequence[object]],
    SelectOfScalar[ActivityType],
]


def _import_phase_f_module(module_name: str) -> ModuleType:
    try:
        return importlib.import_module(module_name)
    except ModuleNotFoundError as exc:
        if exc.name == module_name:
            pytest.fail(f"Phase F contract requires module {module_name!r}.")
        raise


def _get_callable(module: ModuleType, symbol: str) -> Callable[..., object]:
    attr = getattr(module, symbol, None)
    assert callable(attr), f"Expected {module.__name__}.{symbol} callable for Phase F."
    return cast(Callable[..., object], attr)


def test_pagination_schema_module_exposes_contract_symbols() -> None:
    pagination_schema = _import_phase_f_module("app.schemas.pagination")

    assert hasattr(
        pagination_schema,
        "PaginatedResponse",
    ), "Expected PaginatedResponse schema symbol for opt-in list pagination."
    _get_callable(pagination_schema, "encode_cursor")
    _get_callable(pagination_schema, "decode_cursor")


def test_cursor_helpers_round_trip_values() -> None:
    pagination_schema = _import_phase_f_module("app.schemas.pagination")
    encode_cursor = cast(EncodeCursor, _get_callable(pagination_schema, "encode_cursor"))
    decode_cursor = cast(DecodeCursor, _get_callable(pagination_schema, "decode_cursor"))

    raw_values = ("2026-05-18T00:00:00+00:00", "task-cursor-id")
    encoded = encode_cursor(raw_values)
    assert isinstance(encoded, str)
    assert encoded

    decoded = decode_cursor(encoded)
    assert decoded == raw_values


def test_pagination_service_module_exposes_apply_cursor_limit_helper() -> None:
    pagination_service = _import_phase_f_module("app.services.pagination")
    apply_cursor_limit = cast(
        ApplyCursorLimit,
        _get_callable(pagination_service, "apply_cursor_limit"),
    )

    parameter_names = tuple(inspect.signature(apply_cursor_limit).parameters)
    assert parameter_names == ("statement", "limit", "cursor", "order_cols")


def _seed_activity_types_for_pagination() -> tuple[Engine, list[tuple[datetime, str]]]:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    base = datetime(2026, 5, 18, 12, 0, tzinfo=UTC)
    ordered_values: list[tuple[datetime, str]] = []
    with Session(engine) as session:
        for idx in range(5):
            row_id = f"00000000-0000-0000-0000-00000000000{idx + 1}"
            created_at = base + timedelta(minutes=idx)
            row = ActivityType(
                id=row_id,
                name=f"phasef-{idx + 1}",
                slug=f"phasef-{idx + 1}",
                status="active",
                sort_order=idx,
                created_at=created_at,
                updated_at=created_at,
            )
            ordered_values.append((created_at, row_id))
            session.add(row)
        session.commit()

    return engine, ordered_values


def test_apply_cursor_limit_first_page_includes_lookahead_row() -> None:
    pagination_service = _import_phase_f_module("app.services.pagination")
    apply_cursor_limit = cast(
        ApplyCursorLimit,
        _get_callable(pagination_service, "apply_cursor_limit"),
    )

    engine, ordered_values = _seed_activity_types_for_pagination()
    with Session(engine) as session:
        statement = select(ActivityType)
        page_statement = apply_cursor_limit(
            statement,
            2,
            None,
            [col(ActivityType.created_at), col(ActivityType.id)],
        )
        page_rows = list(session.exec(page_statement))

    page_ids = [row.id for row in page_rows]
    expected_ids = [ordered_values[0][1], ordered_values[1][1], ordered_values[2][1]]
    assert page_ids == expected_ids


def test_apply_cursor_limit_follow_up_page_uses_cursor() -> None:
    pagination_schema = _import_phase_f_module("app.schemas.pagination")
    encode_cursor = cast(EncodeCursor, _get_callable(pagination_schema, "encode_cursor"))
    pagination_service = _import_phase_f_module("app.services.pagination")
    apply_cursor_limit = cast(
        ApplyCursorLimit,
        _get_callable(pagination_service, "apply_cursor_limit"),
    )

    engine, ordered_values = _seed_activity_types_for_pagination()
    cursor = encode_cursor([ordered_values[1][0].isoformat(), ordered_values[1][1]])
    with Session(engine) as session:
        statement = select(ActivityType)
        page_statement = apply_cursor_limit(
            statement,
            2,
            cursor,
            [col(ActivityType.created_at), col(ActivityType.id)],
        )
        page_rows = list(session.exec(page_statement))

    page_ids = [row.id for row in page_rows]
    expected_ids = [ordered_values[2][1], ordered_values[3][1], ordered_values[4][1]]
    assert page_ids == expected_ids


def test_apply_cursor_limit_returns_empty_page_when_cursor_is_at_end() -> None:
    pagination_schema = _import_phase_f_module("app.schemas.pagination")
    encode_cursor = cast(EncodeCursor, _get_callable(pagination_schema, "encode_cursor"))
    pagination_service = _import_phase_f_module("app.services.pagination")
    apply_cursor_limit = cast(
        ApplyCursorLimit,
        _get_callable(pagination_service, "apply_cursor_limit"),
    )

    engine, ordered_values = _seed_activity_types_for_pagination()
    final_row = ordered_values[-1]
    end_cursor = encode_cursor([final_row[0].isoformat(), final_row[1]])
    with Session(engine) as session:
        statement = select(ActivityType)
        page_statement = apply_cursor_limit(
            statement,
            2,
            end_cursor,
            [col(ActivityType.created_at), col(ActivityType.id)],
        )
        page_rows = list(session.exec(page_statement))

    assert page_rows == []


def test_apply_cursor_limit_rejects_invalid_cursor() -> None:
    pagination_service = _import_phase_f_module("app.services.pagination")
    apply_cursor_limit = cast(
        ApplyCursorLimit,
        _get_callable(pagination_service, "apply_cursor_limit"),
    )

    with pytest.raises(HTTPException) as exc_info:
        apply_cursor_limit(
            select(ActivityType),
            2,
            "not-a-valid-cursor",
            [col(ActivityType.created_at), col(ActivityType.id)],
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid cursor."


def test_apply_cursor_limit_last_page_has_no_extra_row() -> None:
    pagination_schema = _import_phase_f_module("app.schemas.pagination")
    encode_cursor = cast(EncodeCursor, _get_callable(pagination_schema, "encode_cursor"))
    pagination_service = _import_phase_f_module("app.services.pagination")
    apply_cursor_limit = cast(
        ApplyCursorLimit,
        _get_callable(pagination_service, "apply_cursor_limit"),
    )

    engine, ordered_values = _seed_activity_types_for_pagination()
    cursor_before_last = encode_cursor([ordered_values[3][0].isoformat(), ordered_values[3][1]])
    with Session(engine) as session:
        statement = select(ActivityType)
        page_statement = apply_cursor_limit(
            statement,
            2,
            cursor_before_last,
            [col(ActivityType.created_at), col(ActivityType.id)],
        )
        page_rows = list(session.exec(page_statement))

    assert [row.id for row in page_rows] == [ordered_values[4][1]]
