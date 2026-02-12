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
        from app.runtime import token_service

        c.headers.update({"Authorization": f"Bearer {token_service.generate(100)}"})
        yield c


def test_file_upload_rename_delete_smoke(client: TestClient, tmp_path) -> None:
    resp = client.post(
        "/system/file/upload",
        files={"file": ("a.txt", b"hello", "text/plain")},
        data={"parentPath": "/"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    fid = int(body["data"]["id"])
    assert fid > 0

    assert (tmp_path / f"{fid}.txt").exists()

    resp2 = client.put(f"/system/file/{fid}", json={"originalName": "b.txt"})
    assert resp2.status_code == 200
    assert resp2.json()["success"] is True

    resp3 = client.request("DELETE", "/system/file", json={"ids": [fid]})
    assert resp3.status_code == 200
    assert resp3.json()["success"] is True
    assert not (tmp_path / f"{fid}.txt").exists()


def test_file_dir_create_and_delete_empty_dir(client: TestClient) -> None:
    resp = client.post("/system/file/dir", json={"parentPath": "/", "originalName": "d1"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # lookup dir id by listing
    resp2 = client.get("/system/file", params={"parentPath": "/", "page": 1, "size": 100})
    assert resp2.status_code == 200
    j2 = resp2.json()
    assert j2["success"] is True
    items = j2["data"]["list"]
    d1 = [it for it in items if it.get("type") == 0 and it.get("name") == "d1"]
    assert len(d1) == 1
    did = int(d1[0]["id"])

    resp3 = client.request("DELETE", "/system/file", json={"ids": [did]})
    assert resp3.status_code == 200
    assert resp3.json()["success"] is True
