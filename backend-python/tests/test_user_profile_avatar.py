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
def client(tmp_path) -> Generator[TestClient, None, None]:
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
    app.dependency_overrides[require_user_id] = lambda: 100

    # seed: default storage + user
    from app.db.models.sys_storage import SysStorage
    from app.db.models.sys_user import SysUser

    now = datetime.now()
    with TestingSessionLocal() as db:
        db.add(
            SysStorage(
                id=1,
                name="dev",
                code="local_dev",
                type=1,
                access_key=None,
                secret_key=None,
                endpoint=None,
                region=None,
                bucket_name=str(tmp_path),
                domain=None,
                description="",
                is_default=True,
                sort=1,
                status=1,
                create_user=1,
                create_time=now,
                update_user=None,
                update_time=None,
            )
        )
        db.add(
            SysUser(
                id=100,
                username="u",
                nickname="u",
                password=None,
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
        yield c


def test_user_profile_avatar_upload_returns_avatar_url(client: TestClient) -> None:
    resp = client.patch(
        "/user/profile/avatar",
        files={"avatarFile": ("avatar.png", b"fake", "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "200"
    assert body["success"] is True
    assert isinstance(body["data"]["avatar"], str)
    assert body["data"]["avatar"] != ""
