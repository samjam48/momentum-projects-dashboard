from __future__ import annotations

import base64
import json
from collections.abc import Sequence
from typing import TypeVar

from pydantic import BaseModel

CursorToken = TypeVar("CursorToken")


class PaginatedResponse[CursorToken](BaseModel):
    items: list[CursorToken]
    next_cursor: str | None


def encode_cursor(values: Sequence[str]) -> str:
    raw = json.dumps(list(values), separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def decode_cursor(cursor: str) -> tuple[str, ...]:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode("ascii"))
        payload = json.loads(decoded.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid cursor.") from exc
    if not isinstance(payload, list) or not all(isinstance(value, str) for value in payload):
        raise ValueError("Invalid cursor.")
    return tuple(payload)
