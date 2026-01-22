"""客户端配置接口：/system/client（对齐 backend-go/internal/interfaces/http/client_handler.go）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session, aliased
from sqlalchemy.sql import cast

from app.core.id import next_id
from app.db.models.sys_client import SysClient
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time


router = APIRouter()


def _parse_positive_query_int(request: Request, key: str, default: int) -> tuple[int, bool]:
    if key not in request.query_params:
        return default, True
    raw = (request.query_params.get(key) or "").strip()
    if raw == "":
        return default, True
    try:
        v = int(raw)
    except Exception:
        return 0, False
    return (v, True) if v > 0 else (0, False)


def _normalize_non_empty_unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values or []:
        s = str(v or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def _auth_type_filter_expr(db: Session, values: list[str]):
    dialect = (db.get_bind().dialect.name or "").lower()
    conds = []
    for t in values:
        if dialect.startswith("postgres"):
            conds.append(cast(SysClient.auth_type, JSONB).contains([t]))
        else:
            conds.append(SysClient.auth_type.contains([t]))
    if not conds:
        return None
    expr = conds[0]
    for c in conds[1:]:
        expr = expr | c
    return expr


@router.get("/system/client")
def list_client_page(request: Request, db: Session = Depends(get_db)):
    page, ok1 = _parse_positive_query_int(request, "page", 1)
    if not ok1:
        return fail("400", "page 参数不正确")
    size, ok2 = _parse_positive_query_int(request, "size", 10)
    if not ok2:
        return fail("400", "size 参数不正确")

    client_type = (request.query_params.get("clientType") or "").strip()
    auth_types = _normalize_non_empty_unique(request.query_params.getlist("authType") if hasattr(request.query_params, "getlist") else [])

    has_status = False
    status_val = 0
    if "status" in request.query_params:
        raw = (request.query_params.get("status") or "").strip()
        if raw != "":
            try:
                v = int(raw)
                if v < 0:
                    return fail("400", "status 参数不正确")
                has_status = True
                status_val = v
            except Exception:
                return fail("400", "status 参数不正确")

    u_create = aliased(SysUser)
    u_update = aliased(SysUser)

    base = select(SysClient.id).select_from(SysClient).join(u_create, u_create.id == SysClient.create_user, isouter=True)

    if client_type:
        base = base.where(SysClient.client_type == client_type)
    if has_status:
        base = base.where(SysClient.status == int(status_val))
    auth_expr = _auth_type_filter_expr(db, auth_types)
    if auth_expr is not None:
        base = base.where(auth_expr)

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
    total = int(total or 0)
    if total == 0:
        return ok({"list": [], "total": 0})

    stmt = (
        select(
            SysClient.id,
            SysClient.client_id,
            SysClient.client_type,
            SysClient.auth_type,
            SysClient.active_timeout,
            SysClient.timeout,
            SysClient.status,
            SysClient.create_time,
            func.coalesce(u_create.nickname, ""),
            SysClient.update_time,
            func.coalesce(u_update.nickname, ""),
        )
        .select_from(SysClient)
        .join(u_create, u_create.id == SysClient.create_user, isouter=True)
        .join(u_update, u_update.id == SysClient.update_user, isouter=True)
    )
    if client_type:
        stmt = stmt.where(SysClient.client_type == client_type)
    if has_status:
        stmt = stmt.where(SysClient.status == int(status_val))
    if auth_expr is not None:
        stmt = stmt.where(auth_expr)

    stmt = stmt.order_by(SysClient.id.desc()).limit(size).offset((page - 1) * size)
    rows = db.execute(stmt).all()

    out = []
    for r in rows:
        auth = r[3] if isinstance(r[3], list) else (r[3] or [])
        out.append(
            {
                "id": int(r[0]),
                "clientId": str(r[1] or ""),
                "clientType": str(r[2] or ""),
                "authType": auth,
                "activeTimeout": int(r[4] or 0),
                "timeout": int(r[5] or 0),
                "status": int(r[6] or 0),
                "createUser": str(r[8] or ""),
                "createTime": format_time(r[7]),
                "updateUser": str(r[10] or ""),
                "updateTime": format_time(r[9]) if r[9] is not None else "",
                "createUserString": str(r[8] or ""),
                "updateUserString": str(r[10] or ""),
            }
        )

    return ok({"list": out, "total": total})


@router.get("/system/client/{id}")
def get_client(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    u_create = aliased(SysUser)
    u_update = aliased(SysUser)
    row = db.execute(
        select(
            SysClient.id,
            SysClient.client_id,
            SysClient.client_type,
            SysClient.auth_type,
            SysClient.active_timeout,
            SysClient.timeout,
            SysClient.status,
            SysClient.create_time,
            func.coalesce(u_create.nickname, ""),
            SysClient.update_time,
            func.coalesce(u_update.nickname, ""),
        )
        .select_from(SysClient)
        .join(u_create, u_create.id == SysClient.create_user, isouter=True)
        .join(u_update, u_update.id == SysClient.update_user, isouter=True)
        .where(SysClient.id == int(id))
        .limit(1)
    ).first()
    if row is None:
        return fail("404", "客户端不存在")

    auth = row[3] if isinstance(row[3], list) else (row[3] or [])
    resp = {
        "id": int(row[0]),
        "clientId": str(row[1] or ""),
        "clientType": str(row[2] or ""),
        "authType": auth,
        "activeTimeout": int(row[4] or 0),
        "timeout": int(row[5] or 0),
        "status": int(row[6] or 0),
        "createUser": str(row[8] or ""),
        "createTime": format_time(row[7]),
        "updateUser": str(row[10] or ""),
        "updateTime": format_time(row[9]) if row[9] is not None else "",
        "createUserString": str(row[8] or ""),
        "updateUserString": str(row[10] or ""),
    }
    return ok(resp)


@router.post("/system/client")
def create_client(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    client_type = str(body.get("clientType") or "").strip()
    auth_type = body.get("authType") if isinstance(body.get("authType"), list) else []
    auth_type = _normalize_non_empty_unique([str(v) for v in auth_type])
    if client_type == "" or len(auth_type) == 0:
        return fail("400", "客户端类型和认证类型不能为空")

    active_timeout = int(body.get("activeTimeout") or 0)
    timeout = int(body.get("timeout") or 0)
    status = int(body.get("status") or 0)
    if active_timeout == 0:
        active_timeout = 1800
    if timeout == 0:
        timeout = 86400
    if status == 0:
        status = 1

    cid = format(next_id(), "x")
    rid = next_id()
    if rid == 0:
        return fail("500", "生成客户端 ID 失败")

    now = datetime.now()
    try:
        db.add(
            SysClient(
                id=rid,
                client_id=cid,
                client_type=client_type,
                auth_type=auth_type,
                active_timeout=active_timeout,
                timeout=timeout,
                status=status,
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增客户端失败")

    return ok({"id": rid})


@router.put("/system/client/{id}")
def update_client(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    client_type = str(body.get("clientType") or "").strip()
    auth_type = body.get("authType") if isinstance(body.get("authType"), list) else []
    auth_type = _normalize_non_empty_unique([str(v) for v in auth_type])
    if client_type == "" or len(auth_type) == 0:
        return fail("400", "客户端类型和认证类型不能为空")

    active_timeout = int(body.get("activeTimeout") or 0)
    timeout = int(body.get("timeout") or 0)
    status = int(body.get("status") or 0)
    if status == 0:
        status = 1

    now = datetime.now()
    try:
        db.execute(
            update(SysClient)
            .where(SysClient.id == int(id))
            .values(
                client_type=client_type,
                auth_type=auth_type,
                active_timeout=active_timeout,
                timeout=timeout,
                status=status,
                update_user=int(user_id),
                update_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改客户端失败")
    return ok(True)


@router.delete("/system/client")
def delete_client(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict) or not isinstance(body.get("ids"), list) or len(body["ids"]) == 0:
        return fail("400", "ID 列表不能为空")
    ids = []
    for v in body["ids"]:
        try:
            iv = int(v)
            if iv > 0:
                ids.append(iv)
        except Exception:
            continue
    if not ids:
        return fail("400", "ID 列表不能为空")

    try:
        db.execute(delete(SysClient).where(SysClient.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除客户端失败")
    return ok(True)
