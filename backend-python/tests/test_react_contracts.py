from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker


def test_react_response_wrapper_contract() -> None:
    from app.http.react_routes.response import ResultStatus, fail, ok

    r_ok = ok({"k": "v"})
    assert r_ok["status"] == ResultStatus.SUCCESS
    assert r_ok["message"] == ""
    assert r_ok["data"] == {"k": "v"}

    r_fail = fail("x")
    assert r_fail["status"] == ResultStatus.ERROR
    assert r_fail["message"] == "x"
    assert r_fail["data"] is None


def test_config_admin_frontend_type_contract(monkeypatch) -> None:
    from app.config import load_settings

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_JWT_SECRET", "test-secret")
    monkeypatch.setenv("ADMIN_FRONTEND_TYPE", "react")
    s = load_settings()
    assert s.admin_frontend_type == "react"

    monkeypatch.setenv("ADMIN_FRONTEND_TYPE", "invalid")
    try:
        load_settings()
        raise AssertionError("expected invalid ADMIN_FRONTEND_TYPE to raise")
    except RuntimeError:
        pass


@pytest.fixture()
def user_id() -> int:
    return 100


@pytest.fixture()
def seed_data(session_local: sessionmaker[Session]) -> None:
    from app.db.models.sys_menu import SysMenu
    from app.db.models.sys_role import SysRole
    from app.db.models.sys_role_menu import SysRoleMenu
    from app.db.models.sys_user_role import SysUserRole

    now = datetime.now()
    with session_local() as db:
        db.add(
            SysRole(
                id=1,
                name="r1",
                code="r1",
                data_scope=4,
                description="",
                sort=1,
                is_system=False,
                menu_check_strictly=True,
                dept_check_strictly=True,
                create_user=1,
                create_time=now,
                update_user=None,
                update_time=None,
            )
        )
        db.add(SysUserRole(id=1, user_id=100, role_id=1))
        db.add(
            SysMenu(
                id=10,
                title="Dashboard",
                frontend="react",
                parent_id=0,
                type=1,
                path="/dashboard",
                name="dashboard",
                component="dashboard/index",
                redirect=None,
                icon="",
                is_external=False,
                is_cache=False,
                is_hidden=False,
                permission="",
                sort=1,
                status=1,
                create_user=1,
                create_time=now,
                update_user=None,
                update_time=None,
            )
        )
        db.add(SysRoleMenu(role_id=1, menu_id=10))
        db.commit()


def test_react_menu_requires_auth(anon_react_client: TestClient) -> None:
    resp = anon_react_client.get("/menu")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == 401
    assert isinstance(data.get("data"), list)
    assert data["data"] == []


def test_react_user_token_expired_endpoint_contract(react_client: TestClient) -> None:
    resp = react_client.post("/user/tokenExpired")
    assert resp.status_code == 401


def test_react_menu_returns_tree_when_authed(react_client: TestClient) -> None:
    resp = react_client.get("/menu")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == 0
    assert isinstance(data.get("data"), list)
    assert len(data["data"]) > 0
    first = data["data"][0]
    assert isinstance(first.get("id"), str)
    assert isinstance(first.get("parentId"), str)
    assert isinstance(first.get("name"), str)
    assert "children" in first
