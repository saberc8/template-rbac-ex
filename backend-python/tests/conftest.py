from __future__ import annotations

import os
from collections.abc import Generator
from contextlib import suppress
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture()
def user_id() -> int:
    return 1


@pytest.fixture()
def session_local(monkeypatch: pytest.MonkeyPatch) -> sessionmaker[Session]:
    # 该 fixture 由多数测试依赖，因此在这里统一设置基础运行环境。
    # 使用 monkeypatch 避免环境变量泄漏到其他测试/用例。
    monkeypatch.setenv("APP_ENV", os.environ.get("APP_ENV") or "production")
    monkeypatch.setenv("AUTH_JWT_SECRET", os.environ.get("AUTH_JWT_SECRET") or "test-secret")

    from app.db import models as _  # noqa: F401
    from app.db.base import Base

    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)
    return SessionLocal


@pytest.fixture()
def app(session_local: sessionmaker[Session], user_id: int) -> Any:
    from app.http.deps import get_db, require_user_id
    from app.main import create_app

    app = create_app()

    def _override_get_db() -> Generator[Session, None, None]:
        db = session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[require_user_id] = lambda: int(user_id)
    return app


@pytest.fixture()
def client(app: Any, user_id: int, request: pytest.FixtureRequest) -> Generator[TestClient, None, None]:
    # 允许每个测试文件按需提供 seed_data(session_local, ...) fixture。
    with suppress(pytest.FixtureLookupError):
        request.getfixturevalue("seed_data")

    with TestClient(app) as c:
        from app.runtime import token_service

        c.headers.update({"Authorization": f"Bearer {token_service.generate(int(user_id))}"})
        yield c


@pytest.fixture()
def react_app(session_local: sessionmaker[Session], user_id: int, monkeypatch: pytest.MonkeyPatch) -> Any:
    monkeypatch.setenv("ADMIN_FRONTEND_TYPE", "react")

    from app.http.deps import get_db, require_user_id
    from app.main import create_app

    app = create_app()

    def _override_get_db() -> Generator[Session, None, None]:
        db = session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[require_user_id] = lambda: int(user_id)
    return app


@pytest.fixture()
def react_client(react_app: Any, user_id: int, request: pytest.FixtureRequest) -> Generator[TestClient, None, None]:
    with suppress(pytest.FixtureLookupError):
        request.getfixturevalue("seed_data")

    with TestClient(react_app) as c:
        from app.runtime import token_service

        c.headers.update({"Authorization": f"Bearer {token_service.generate(int(user_id))}"})
        yield c


@pytest.fixture()
def anon_react_client(react_app: Any, request: pytest.FixtureRequest) -> Generator[TestClient, None, None]:
    with suppress(pytest.FixtureLookupError):
        request.getfixturevalue("seed_data")

    with TestClient(react_app) as c:
        yield c
