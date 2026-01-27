"""系统配置接口：/system/option（对齐 backend-go/internal/interfaces/http/option_handler.go）。"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.db.models.sys_option import SysOption
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import get_query_list


router = APIRouter()


def _to_option_value_string(v) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        try:
            return str(int(v))
        except Exception:
            return ""
    try:
        return json.dumps(v, ensure_ascii=False)
    except Exception:
        return ""


@router.get("/system/option")
def list_option(request: Request, db: Session = Depends(get_db)):
    codes = get_query_list(request, "code")
    category = (request.query_params.get("category") or "").strip()

    stmt = select(
        SysOption.id,
        SysOption.name,
        SysOption.code,
        func.coalesce(SysOption.value, SysOption.default_value, ""),
        func.coalesce(SysOption.description, ""),
    ).select_from(SysOption)
    if codes:
        stmt = stmt.where(SysOption.code.in_(codes))
    if category:
        stmt = stmt.where(SysOption.category == category)
    stmt = stmt.order_by(SysOption.id.asc())

    rows = db.execute(stmt).all()
    out = []
    for r in rows:
        out.append(
            {
                "id": int(r[0]),
                "name": r[1],
                "code": r[2],
                "value": str(r[3] or ""),
                "description": str(r[4] or ""),
            }
        )
    return ok(out)


@router.put("/system/option")
def update_option(
    body: Optional[list] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if not isinstance(body, list) or len(body) == 0:
        return fail("400", "请求参数不正确")

    updates_req: list[tuple[int, str, str]] = []
    for it in body:
        if not isinstance(it, dict):
            return fail("400", "请求参数不正确")
        try:
            oid = int(it.get("id") or 0)
        except Exception:
            oid = 0
        code = str(it.get("code") or "").strip()
        if oid <= 0 or code == "":
            return fail("400", "请求参数不正确")
        updates_req.append((oid, code, _to_option_value_string(it.get("value"))))

    now = datetime.now()
    try:
        for oid, code, val in updates_req:
            db.execute(
                update(SysOption)
                .where(SysOption.id == oid)
                .where(SysOption.code == code)
                .values(value=val, update_user=int(user_id), update_time=now)
            )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "保存系统配置失败")
    return ok(True)


@router.patch("/system/option/value")
def reset_option_value(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")
    codes = body.get("code") if isinstance(body.get("code"), list) else []
    category = str(body.get("category") or "").strip()
    codes = [str(c).strip() for c in codes if str(c).strip()]

    if len(codes) == 0 and category == "":
        return fail("400", "键列表或类别不能为空")

    try:
        if category:
            db.execute(update(SysOption).where(SysOption.category == category).values(value=None))
        else:
            db.execute(update(SysOption).where(SysOption.code.in_(codes)).values(value=None))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "恢复默认配置失败")
    return ok(True)
