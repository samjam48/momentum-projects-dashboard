from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.database import get_engine
from app.main import create_app


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    database_path = tmp_path / "momentum-test.db"
    monkeypatch.setenv("MOMENTUM_DATABASE_URL", f"sqlite:///{database_path}")
    get_settings.cache_clear()
    get_engine.cache_clear()

    with TestClient(create_app()) as test_client:
        yield test_client

    get_engine.cache_clear()
    get_settings.cache_clear()
