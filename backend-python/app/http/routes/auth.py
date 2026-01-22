"""认证接口：/auth/login /auth/logout。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.captcha import build_redis_key
from app.db.models.sys_option import SysOption
from app.db.models.sys_user import SysUser
from app.http.deps import get_db
from app.http.response import fail, ok
from app.runtime import online_store, redis_client, token_service
from app.security.password import verify_password


router = APIRouter()


def _is_option_enabled(db: Session, code: str) -> bool:
    code = (code or "").strip()
    if code == "":
        return False
    stmt = (
        select(func.coalesce(SysOption.value, SysOption.default_value, ""))
        .where(SysOption.code == code)
        .limit(1)
    )
    val = db.execute(stmt).scalar_one_or_none()
    if val is None:
        return False
    val = str(val).strip()
    return val != "" and val != "0"


@router.post("/auth/login")
def login(
    request: Request,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
):
    if not isinstance(body, dict):
        return fail("400", "参数缺失或格式不正确")

    client_id = str(body.get("clientId") or "").strip()
    auth_type = str(body.get("authType") or "").strip().upper()
    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or "").strip()
    captcha = str(body.get("captcha") or "").strip()
    uuid = str(body.get("uuid") or "").strip()

    if auth_type != "" and auth_type != "ACCOUNT":
        return fail("400", "暂不支持该认证方式")
    if client_id == "":
        return fail("400", "客户端ID不能为空")
    if username == "":
        return fail("400", "用户名不能为空")
    if password == "":
        return fail("400", "密码不能为空")

    if _is_option_enabled(db, "LOGIN_CAPTCHA_ENABLED"):
        if captcha == "":
            return fail("400", "验证码不能为空")
        if uuid == "":
            return fail("400", "验证码标识不能为空")
        key = build_redis_key(uuid)
        try:
            val = redis_client.get(key)
        except Exception:
            return fail("500", "验证码服务未初始化")
        if not val or str(val).strip().lower() != captcha.strip().lower():
            return fail("400", "验证码不正确或已过期")
        try:
            redis_client.delete(key)
        except Exception:
            pass

    user = db.execute(select(SysUser).where(SysUser.username == username).limit(1)).scalar_one_or_none()
    if user is None:
        return fail("400", "用户名或密码不正确")

    if not verify_password(password, user.password or ""):
        return fail("400", "用户名或密码不正确")

    if int(user.status or 0) != 1:
        return fail("400", "此账号已被禁用，如有疑问，请联系管理员")

    token = token_service.generate(int(user.id))
    resp = {
        "token": token,
        "userId": int(user.id),
        "username": user.username,
        "nickname": user.nickname,
    }

    ip = request.client.host if request.client else ""
    ua = request.headers.get("User-Agent") or ""
    online_store.record_login(
        user_id=int(user.id),
        username=user.username,
        nickname=user.nickname,
        client_id=client_id,
        token=token,
        ip=ip,
        user_agent=ua,
    )
    return ok(resp)


@router.post("/auth/logout")
def logout(request: Request):
    authz = (request.headers.get("Authorization") or "").strip()
    token = authz
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    if token:
        online_store.remove_by_token(token)
    return ok(True)
