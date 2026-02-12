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

    # seed: dept + role
    from app.db.models.sys_dept import SysDept
    from app.db.models.sys_role import SysRole

    now = datetime.now()
    with TestingSessionLocal() as db:
        db.add(
            SysDept(
                id=1,
                name="默认部门",
                parent_id=0,
                sort=1,
                status=1,
                is_system=True,
                create_user=1,
                create_time=now,
                update_user=None,
                update_time=None,
            )
        )
        db.add(
            SysRole(
                id=1,
                name="r1",
                code="r1",
                sort=1,
                is_system=False,
                data_scope=1,
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


def test_system_user_crud_smoke(client: TestClient) -> None:
    # create
    resp = client.post(
        "/system/user",
        json={
            "username": "u1",
            "nickname": "n1",
            "password": "ChangeMe123",
            "gender": 1,
            "status": 1,
            "deptId": 1,
            "roleIds": [1],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    uid = int(body["data"]["id"])
    assert uid > 0

    # update
    resp2 = client.put(
        f"/system/user/{uid}",
        json={
            "username": "u1",
            "nickname": "n2",
            "gender": 0,
            "status": 1,
            "deptId": 1,
            "roleIds": [],
        },
    )
    assert resp2.status_code == 200
    assert resp2.json()["success"] is True

    # reset password
    resp3 = client.patch(
        f"/system/user/{uid}/password",
        json={"newPassword": "NewPass123"},
    )
    assert resp3.status_code == 200
    assert resp3.json()["success"] is True

    # delete
    resp4 = client.request("DELETE", "/system/user", json={"ids": [uid]})
    assert resp4.status_code == 200
    assert resp4.json()["success"] is True

    # verify deleted
    resp5 = client.get(f"/system/user/{uid}")
    assert resp5.status_code == 200
    j5 = resp5.json()
    assert j5["success"] is False
    assert j5["code"] == "404"
