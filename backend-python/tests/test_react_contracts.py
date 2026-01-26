from __future__ import annotations


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
        assert False, "expected invalid ADMIN_FRONTEND_TYPE to raise"
    except RuntimeError:
        pass

