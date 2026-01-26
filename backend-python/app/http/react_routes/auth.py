"""slash-admin(React) 认证接口：/auth/signin /auth/logout。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.sys_user import SysUser
from app.http.deps import get_db
from app.http.react_routes import query
from app.http.react_routes.response import fail, ok
from app.runtime import online_store, token_service
from app.security.password import verify_password


router = APIRouter()


@router.post("/auth/signin")
def signin(
    request: Request,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
):
    if not isinstance(body, dict):
        return fail("参数缺失或格式不正确", status=400)

    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or "").strip()
    if username == "" or password == "":
        return fail("Incorrect username or password.", status=10001)

    user = db.execute(select(SysUser).where(SysUser.username == username).limit(1)).scalar_one_or_none()
    if user is None:
        return fail("Incorrect username or password.", status=10001)
    if not verify_password(password, user.password or ""):
        return fail("Incorrect username or password.", status=10001)
    if int(user.status or 0) != 1:
        return fail("Account disabled.", status=10002)

    roles, role_ids = query.list_user_roles(db, int(user.id))
    permissions = query.list_user_permissions(db, int(user.id))
    menu = query.list_menu_tree(db, role_ids=role_ids)

    token = token_service.generate(int(user.id))
    data = {
        "user": {
            "id": str(int(user.id)),
            "username": user.username,
            "email": str(user.email or ""),
            "avatar": str(user.avatar or ""),
            "roles": roles,
            "permissions": permissions,
            "menu": menu,
        },
        "accessToken": token,
        "refreshToken": token,
    }

    ip = request.client.host if request.client else ""
    ua = request.headers.get("User-Agent") or ""
    online_store.record_login(
        user_id=int(user.id),
        username=user.username,
        nickname=user.nickname or user.username,
        client_id="react",
        token=token,
        ip=ip,
        user_agent=ua,
    )
    return ok(data)


@router.get("/auth/logout")
def logout(request: Request):
    authz = (request.headers.get("Authorization") or "").strip()
    token = authz
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    if token:
        online_store.remove_by_token(token)
    return ok(True)


@router.get("/auth/refresh")
def refresh(request: Request):
    # 当前实现不维护 refresh token 状态，返回新 access token 以满足前端调用契约。
    authz = (request.headers.get("Authorization") or "").strip()
    if authz == "":
        return fail("Unauthorized", status=401)
    try:
        claims = token_service.parse(authz)
    except Exception:
        return fail("Unauthorized", status=401)
    token = token_service.generate(int(claims.user_id))
    return ok({"accessToken": token, "refreshToken": token})
