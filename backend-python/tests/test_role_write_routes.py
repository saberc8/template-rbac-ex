from __future__ import annotations

import os
from collections.abc import Generator

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


def test_role_write_routes_permission_frontend_isolation(client: TestClient) -> None:
    # create role
    r1 = client.post("/system/role", json={"name": "r1", "code": "r1", "sort": 1, "dataScope": 4})
    assert r1.status_code == 200
    j1 = r1.json()
    assert j1["success"] is True
    rid = int(j1["data"]["id"])
    assert rid > 0

    # seed menus in different datasets
    r2 = client.post(
        "/system/menu",
        headers={"X-Admin-Frontend": "react"},
        json={"title": "m-react", "parentId": 0, "type": 1, "path": "/mr", "name": "mr", "component": "mr/index"},
    )
    assert r2.status_code == 200
    mid_react = int(r2.json()["data"]["id"])
    assert mid_react > 0

    r3 = client.post(
        "/system/menu",
        headers={"X-Admin-Frontend": "vue3"},
        json={"title": "m-vue3", "parentId": 0, "type": 1, "path": "/mv", "name": "mv", "component": "mv/index"},
    )
    assert r3.status_code == 200
    mid_vue3 = int(r3.json()["data"]["id"])
    assert mid_vue3 > 0

    # save permissions (react)
    r4 = client.put(
        f"/system/role/{rid}/permission",
        headers={"X-Admin-Frontend": "react"},
        json={"menuIds": [str(mid_react)], "menuCheckStrictly": True},
    )
    assert r4.status_code == 200
    assert r4.json()["success"] is True

    g1 = client.get(f"/system/role/{rid}", headers={"X-Admin-Frontend": "react"})
    assert g1.status_code == 200
    jg1 = g1.json()
    assert jg1["success"] is True
    assert jg1["data"]["menuIds"] == [str(mid_react)]

    # save permissions (vue3) - should not overwrite react dataset
    r5 = client.put(
        f"/system/role/{rid}/permission",
        headers={"X-Admin-Frontend": "vue3"},
        json={"menuIds": [mid_vue3], "menuCheckStrictly": False},
    )
    assert r5.status_code == 200
    assert r5.json()["success"] is True

    g2 = client.get(f"/system/role/{rid}", headers={"X-Admin-Frontend": "react"})
    assert g2.status_code == 200
    assert g2.json()["data"]["menuIds"] == [str(mid_react)]

    g3 = client.get(f"/system/role/{rid}", headers={"X-Admin-Frontend": "vue3"})
    assert g3.status_code == 200
    assert g3.json()["data"]["menuIds"] == [mid_vue3]

    # update role
    r6 = client.put(f"/system/role/{rid}", json={"name": "r1b", "sort": 2, "dataScope": 4, "description": ""})
    assert r6.status_code == 200
    assert r6.json()["success"] is True

    # delete role
    r7 = client.request("DELETE", "/system/role", json={"ids": [rid]})
    assert r7.status_code == 200
    assert r7.json()["success"] is True
