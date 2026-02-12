from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


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
def react_client() -> Generator[TestClient, None, None]:
    os.environ.setdefault("APP_ENV", "production")
    os.environ.setdefault("AUTH_JWT_SECRET", "test-secret")
    os.environ.setdefault("ADMIN_FRONTEND_TYPE", "react")

    from app.db import models as _  # noqa: F401
    from app.db.base import Base
    from app.http.deps import get_db
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

    with TestClient(app) as c:
        yield c


def test_react_menu_requires_auth(react_client: TestClient) -> None:
    resp = react_client.get("/menu")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == 401
    assert isinstance(data.get("data"), list)
    assert data["data"] == []


def test_react_user_token_expired_endpoint_contract(react_client: TestClient) -> None:
    resp = react_client.post("/user/tokenExpired")
    assert resp.status_code == 401
