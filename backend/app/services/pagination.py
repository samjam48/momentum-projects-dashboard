from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime
from typing import cast

from app.schemas.pagination import decode_cursor
from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel.sql.expression import SelectOfScalar


def _coerce_cursor_value(order_col: ColumnElement[object], value: str) -> object:
    try:
        python_type = order_col.type.python_type
    except NotImplementedError:
        return value
    except AttributeError:
        return value

    if python_type is datetime:
        return datetime.fromisoformat(value)
    if python_type is date:
        return date.fromisoformat(value)
    if python_type is int:
        return int(value)
    if python_type is float:
        return float(value)
    return value


def apply_cursor_limit[RowT](
    statement: SelectOfScalar[RowT],
    limit: int,
    cursor: str | None,
    order_cols: Sequence[object],
) -> SelectOfScalar[RowT]:
    normalized_order_cols = [cast(ColumnElement[object], order_col) for order_col in order_cols]
    if not normalized_order_cols:
        raise ValueError("order_cols must not be empty.")

    paginated_statement = statement.order_by(*normalized_order_cols)
    if cursor is None:
        return paginated_statement.limit(limit + 1)

    try:
        cursor_values = decode_cursor(cursor)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cursor.",
        ) from exc
    if len(cursor_values) != len(normalized_order_cols):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cursor.",
        )

    disjunctions: list[ColumnElement[bool]] = []
    equal_prefix: list[ColumnElement[bool]] = []
    for order_col, cursor_value in zip(normalized_order_cols, cursor_values, strict=True):
        typed_value = _coerce_cursor_value(order_col, cursor_value)
        gt_filter = order_col > typed_value
        if equal_prefix:
            disjunctions.append(and_(*equal_prefix, gt_filter))
        else:
            disjunctions.append(gt_filter)
        equal_prefix.append(order_col == typed_value)

    return paginated_statement.where(or_(*disjunctions)).limit(limit + 1)
