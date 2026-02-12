from __future__ import annotations

import os
from collections.abc import Generator
from datetime import datetime

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

    # seed: root dept (system)
    from app.db.models.sys_dept import SysDept

    now = datetime.now()
    with TestingSessionLocal() as db:
        db.add(
            SysDept(
                id=1,
                name="根部门",
                parent_id=0,
                sort=1,
                status=1,
                is_system=True,
                description="",
                create_user=1,
                create_time=now,
                update_user=None,
                update_time=None,
            )
        )
        db.commit()

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


def test_dept_create_update_delete_smoke(client: TestClient) -> None:
    # create
    r1 = client.post("/system/dept", json={"name": "d1", "parentId": 1, "sort": 1, "status": 1, "description": ""})
    assert r1.status_code == 200
    j1 = r1.json()
    assert j1["success"] is True

    # find by tree
    r2 = client.get("/system/dept/tree")
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2["success"] is True
    roots = j2["data"]
    assert isinstance(roots, list)
    root = [n for n in roots if int(n.get("id") or 0) == 1][0]
    child = [n for n in root.get("children") or [] if n.get("name") == "d1"][0]
    did = int(child["id"])
    assert did > 0

    # update
    r3 = client.put(
        f"/system/dept/{did}",
        json={"name": "d1b", "parentId": 1, "sort": 2, "status": 1, "description": "x"},
    )
    assert r3.status_code == 200
    assert r3.json()["success"] is True

    # delete
    r4 = client.request("DELETE", "/system/dept", json={"ids": [did]})
    assert r4.status_code == 200
    assert r4.json()["success"] is True
