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
    from app.security.password import hash_password

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
    app.dependency_overrides[require_user_id] = lambda: 100

    # seed: user
    from app.db.models.sys_user import SysUser

    now = datetime.now()
    with TestingSessionLocal() as db:
        db.add(
            SysUser(
                id=100,
                username="u",
                nickname="u",
                password=hash_password("OldPass123"),
                gender=0,
                email=None,
                phone=None,
                avatar=None,
                description=None,
                status=1,
                is_system=False,
                pwd_reset_time=None,
                dept_id=1,
                create_user=1,
                create_time=now,
                update_user=None,
                update_time=None,
            )
        )
        db.commit()

    with TestClient(app) as c:
        from app.runtime import token_service

        c.headers.update({"Authorization": f"Bearer {token_service.generate(100)}"})
        yield c


def _assert_ok(resp):
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["code"] == "200"
    return body["data"]


def test_update_basic_info_and_reflect_in_user_info(client: TestClient) -> None:
    _assert_ok(client.put("/user/profile/basic/info", json={"nickname": "n2", "gender": 1}))

    resp = client.get("/auth/user/info")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["nickname"] == "n2"
    assert body["data"]["gender"] == 1


def test_update_phone_requires_old_password(client: TestClient) -> None:
    resp = client.put("/user/profile/phone", json={"phone": "13800138000", "oldPassword": "bad"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False

    _assert_ok(client.put("/user/profile/phone", json={"phone": "13800138000", "oldPassword": "OldPass123"}))
    info = client.get("/auth/user/info").json()["data"]
    assert info["phone"] == "13800138000"


def test_update_email_requires_old_password(client: TestClient) -> None:
    resp = client.put("/user/profile/email", json={"email": "a@b.com", "oldPassword": "bad"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False

    _assert_ok(client.put("/user/profile/email", json={"email": "a@b.com", "oldPassword": "OldPass123"}))
    info = client.get("/auth/user/info").json()["data"]
    assert info["email"] == "a@b.com"


def test_update_password_validates_and_sets_pwd_reset_time(client: TestClient) -> None:
    resp = client.put("/user/profile/password", json={"oldPassword": "OldPass123", "newPassword": "short1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False

    _assert_ok(client.put("/user/profile/password", json={"oldPassword": "OldPass123", "newPassword": "NewPass123"}))
    info = client.get("/auth/user/info").json()["data"]
    assert isinstance(info.get("pwdResetTime") or "", str)
    assert info.get("pwdResetTime") != ""

    # old password no longer works
    resp2 = client.put("/user/profile/phone", json={"phone": "13800138001", "oldPassword": "OldPass123"})
    assert resp2.status_code == 200
    assert resp2.json()["success"] is False
