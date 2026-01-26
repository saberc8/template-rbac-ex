from __future__ import annotations

import os
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    os.environ.setdefault("APP_ENV", "production")
    os.environ.setdefault("AUTH_JWT_SECRET", "test-secret")

    from app.db.base import Base
    from app.db import models as _  # noqa: F401
    from app.http.deps import get_db
    from app.main import create_app

    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    app = create_app()

    def _override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as c:
        yield c


def test_dict_item_route_not_shadowed_by_dict_id_route(client: TestClient) -> None:
    resp = client.get(
        "/system/dict/item",
        params={"dictId": 4, "page": 1, "size": 10, "sort": "createTime,desc"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "200"
    assert data["success"] is True
    assert "data" in data
    assert isinstance(data["data"], dict)
    assert "list" in data["data"]
    assert "total" in data["data"]
