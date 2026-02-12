from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture()
def seed_data(session_local: sessionmaker[Session]) -> None:
    # seed: dept + role
    from app.db.models.sys_dept import SysDept
    from app.db.models.sys_role import SysRole

    now = datetime.now()
    with session_local() as db:
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
