from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    os.environ.setdefault("APP_ENV", "production")
    os.environ.setdefault("AUTH_JWT_SECRET", "test-secret")

    from app.db import models as _  # noqa: F401
    from app.db.base import Base
    from app.http.deps import get_db, require_user_id
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
    app.dependency_overrides[require_user_id] = lambda: 1

    with TestClient(app) as c:
        from app.runtime import token_service

        c.headers.update({"Authorization": f"Bearer {token_service.generate(1)}"})
        yield c


def test_storage_write_routes_smoke(client: TestClient) -> None:
    # create
    resp = client.post(
        "/system/storage",
        json={
            "name": "s1",
            "code": "s1",
            "type": 1,
            "sort": 1,
            "status": 1,
            "bucketName": "./data/file",
            "isDefault": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    sid = int(body["data"]["id"])
    assert sid > 0

    # update
    resp2 = client.put(
        f"/system/storage/{sid}",
        json={
            "name": "s1b",
            "code": "s1",
            "type": 1,
            "sort": 2,
            "status": 1,
            "bucketName": "./data/file",
        },
    )
    assert resp2.status_code == 200
    assert resp2.json()["success"] is True

    # update status
    resp3 = client.put(f"/system/storage/{sid}/status", json={"status": 2})
    assert resp3.status_code == 200
    assert resp3.json()["success"] is True

    # set default
    resp4 = client.put(f"/system/storage/{sid}/default")
    assert resp4.status_code == 200
    assert resp4.json()["success"] is True

    # delete should fail (default storage protected)
    resp5 = client.request("DELETE", "/system/storage", json={"ids": [sid]})
    assert resp5.status_code == 200
    j5 = resp5.json()
    assert j5["success"] is False
    assert j5["code"] == "400"
