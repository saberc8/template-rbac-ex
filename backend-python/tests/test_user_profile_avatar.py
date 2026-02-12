from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture()
def user_id() -> int:
    return 100


@pytest.fixture()
def seed_data(session_local: sessionmaker[Session], tmp_path) -> None:
    # seed: default storage + user
    from app.db.models.sys_storage import SysStorage
    from app.db.models.sys_user import SysUser

    now = datetime.now()
    with session_local() as db:
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
