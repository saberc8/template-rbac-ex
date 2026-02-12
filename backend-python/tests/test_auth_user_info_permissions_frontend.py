from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture()
def seed_data(session_local: sessionmaker[Session]) -> None:
    from app.db.models.sys_menu import SysMenu
    from app.db.models.sys_role import SysRole
    from app.db.models.sys_role_menu import SysRoleMenu
    from app.db.models.sys_user import SysUser
    from app.db.models.sys_user_role import SysUserRole

    now = datetime.now()
    with session_local() as db:
        db.add(
            SysUser(
                id=1,
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
        db.add(
            SysRole(
                id=1,
                name="r1",
                code="r1",
                sort=1,
                is_system=False,
                data_scope=4,
                description="",
                menu_check_strictly=True,
                dept_check_strictly=True,
                create_user=1,
                create_time=now,
                update_user=None,
                update_time=None,
            )
        )
        db.add(SysUserRole(id=1, user_id=1, role_id=1))
        db.add(
            SysMenu(
                id=10,
                title="m-react",
                frontend="react",
                parent_id=0,
                type=3,
                path=None,
                name=None,
                component=None,
                redirect=None,
                icon="",
                is_external=False,
                is_cache=False,
                is_hidden=False,
                permission="p:react",
                sort=1,
                status=1,
                create_user=1,
                create_time=now,
                update_user=None,
                update_time=None,
            )
        )
        db.add(
            SysMenu(
                id=11,
                title="m-vue3",
                frontend="vue3",
                parent_id=0,
                type=3,
                path=None,
                name=None,
                component=None,
                redirect=None,
                icon="",
                is_external=False,
                is_cache=False,
                is_hidden=False,
                permission="p:vue3",
                sort=1,
                status=1,
                create_user=1,
                create_time=now,
                update_user=None,
                update_time=None,
            )
        )
        db.add(SysRoleMenu(role_id=1, menu_id=10))
        db.add(SysRoleMenu(role_id=1, menu_id=11))
        db.commit()


def test_auth_user_info_permissions_filtered_by_frontend(client: TestClient) -> None:
    r1 = client.get("/auth/user/info", headers={"X-Admin-Frontend": "react"})
    assert r1.status_code == 200
    j1 = r1.json()
    assert j1["success"] is True
    assert set(j1["data"]["permissions"]) == {"p:react"}

    r2 = client.get("/auth/user/info", headers={"X-Admin-Frontend": "vue3"})
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2["success"] is True
    assert set(j2["data"]["permissions"]) == {"p:vue3"}
