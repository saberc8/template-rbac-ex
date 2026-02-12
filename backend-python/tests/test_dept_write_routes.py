from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture()
def seed_data(session_local: sessionmaker[Session]) -> None:
    # seed: root dept (system)
    from app.db.models.sys_dept import SysDept

    now = datetime.now()
    with session_local() as db:
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
