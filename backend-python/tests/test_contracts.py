from __future__ import annotations

from pathlib import Path
import re
import sys


BACKEND_PY_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_PY_ROOT.parent
if str(BACKEND_PY_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_PY_ROOT))


def _extract_go_routes() -> set[tuple[str, str]]:
    http_dir = REPO_ROOT / "backend-go" / "internal" / "interfaces" / "http"
    routes: set[tuple[str, str]] = set()
    if not http_dir.exists():
        return routes

    method_re = re.compile(r'\.(GET|POST|PUT|DELETE|PATCH)\("([^"]+)"')
    param_re = re.compile(r":([A-Za-z_][A-Za-z0-9_]*)")

    for path in http_dir.rglob("*.go"):
        if path.name.endswith("_test.go"):
            continue
        text = path.read_text(encoding="utf-8")
        for m in method_re.finditer(text):
            method = m.group(1)
            p = m.group(2)
            p = param_re.sub(r"{\1}", p)
            routes.add((method, p))
    return routes


def _extract_py_routes() -> set[tuple[str, str]]:
    routes_dir = BACKEND_PY_ROOT / "app" / "http" / "routes"
    routes: set[tuple[str, str]] = set()
    if not routes_dir.exists():
        return routes

    method_re = re.compile(r'@router\.(get|post|put|delete|patch)\("([^"]+)"')

    for path in routes_dir.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for m in method_re.finditer(text):
            method = m.group(1).upper()
            p = m.group(2)
            routes.add((method, p))
    return routes


def test_routes_match_backend_go() -> None:
    go_routes = _extract_go_routes()
    py_routes = _extract_py_routes()
    assert go_routes, "未找到 Go 路由（backend-go/internal/interfaces/http）"
    assert py_routes, "未找到 Python 路由（backend-python/app/http/routes）"
    assert go_routes == py_routes


def test_response_wrapper_contract() -> None:
    from app.http.response import fail, ok

    r_ok = ok({"k": "v"})
    assert r_ok["code"] == "200"
    assert r_ok["success"] is True
    assert r_ok["msg"] == "操作成功"
    assert isinstance(r_ok["timestamp"], str)
    assert int(r_ok["timestamp"]) > 0

    r_fail = fail("400", "x")
    assert r_fail["code"] == "400"
    assert r_fail["success"] is False
    assert r_fail["msg"] == "x"
    assert r_fail["data"] is None
    assert int(r_fail["timestamp"]) > 0


def test_jwt_contract_user_id_claim() -> None:
    from app.security.jwt import TokenService

    svc = TokenService(secret="test-secret", ttl_seconds=60)
    token = svc.generate(123)
    claims = svc.parse(token)
    assert claims.user_id == 123


def test_captcha_redis_key_contract() -> None:
    from app.core.captcha import build_redis_key

    assert build_redis_key("abc") == "CAPTCHA:abc"


def test_bcrypt_password_contract() -> None:
    from app.security.password import hash_password, verify_password

    encoded = hash_password("Abcdefg1")
    assert encoded.startswith("{bcrypt}")
    assert verify_password("Abcdefg1", encoded) is True
    assert verify_password("wrong", encoded) is False


def test_config_database_url_contract() -> None:
    from app.config import load_settings

    # 避免测试时读取 .env
    import os

    os.environ["APP_ENV"] = "production"
    os.environ["AUTH_JWT_SECRET"] = "test-secret"
    os.environ["DB_HOST"] = "127.0.0.1"
    os.environ["DB_USER"] = "u"
    os.environ["DB_PWD"] = "p"
    os.environ["DB_NAME"] = "db"

    os.environ["DB_DIALECT"] = "postgres"
    os.environ["DB_PORT"] = "5432"
    os.environ["DB_SSLMODE"] = "disable"
    s = load_settings()
    assert s.database_url.startswith("postgresql+psycopg2://u:p@127.0.0.1:5432/db?sslmode=")

    os.environ["DB_DIALECT"] = "mysql"
    os.environ["DB_PORT"] = "3306"
    s2 = load_settings()
    assert s2.database_url.startswith("mysql+pymysql://u:p@127.0.0.1:3306/db?charset=utf8mb4")


def test_models_primary_key_not_autoincrement() -> None:
    from app.db.base import Base
    from app.db import models as _  # noqa: F401

    must_tables = [
        "sys_user",
        "sys_role",
        "sys_user_role",
        "sys_menu",
        "sys_file",
        "sys_option",
        "sys_storage",
        "sys_client",
        "sys_dept",
        "sys_dict",
        "sys_dict_item",
        "sys_log",
    ]
    for t in must_tables:
        table = Base.metadata.tables[t]
        col = table.c.id
        assert col.autoincrement is False


def test_captcha_ttl_contract(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_JWT_SECRET", "test-secret")

    import app.http.routes.captcha as captcha

    calls = {}

    class FakeRedis:
        def set(self, key, value, ex=None):
            calls["key"] = key
            calls["value"] = value
            calls["ex"] = ex

    monkeypatch.setattr(captcha, "redis_client", FakeRedis())
    monkeypatch.setattr(captcha, "_is_option_enabled", lambda _db, _code: True)
    monkeypatch.setattr(captcha, "_render_png_base64", lambda _code, _w, _h: "data:image/png;base64,xxx")

    resp = captcha.get_image_captcha(db=None)
    assert resp["code"] == "200"
    assert resp["success"] is True
    assert resp["data"]["isEnabled"] is True
    assert calls["ex"] == 120
    assert calls["key"].startswith("CAPTCHA:")
