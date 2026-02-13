"""字典管理接口：/system/dict/*（对齐 backend-go/internal/interfaces/http/dict_handler.go）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.db.models.sys_dict import SysDict
from app.db.models.sys_dict_item import SysDictItem
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time
from app.http.validators import (
    parse_int,
    parse_page_size,
    parse_positive_int_list,
    require_dict_body,
    require_non_empty_str,
)
from app.services import dict_service

router = APIRouter()


def _dict_resp(row: dict) -> dict:
    ct = row.get("create_time")
    ut = row.get("update_time")
    return {
        "id": int(row.get("id") or 0),
        "name": row.get("name") or "",
        "code": row.get("code") or "",
        "isSystem": bool(row.get("is_system") or False),
        "description": row.get("description") or "",
        "createUserString": row.get("create_user_string") or "",
        "createTime": format_time(ct) if isinstance(ct, datetime) else "",
        "updateUserString": row.get("update_user_string") or "",
        "updateTime": format_time(ut) if isinstance(ut, datetime) else "",
    }


def _dict_item_resp(row: dict) -> dict:
    ct = row.get("create_time")
    ut = row.get("update_time")
    return {
        "id": int(row.get("id") or 0),
        "label": row.get("label") or "",
        "value": row.get("value") or "",
        "color": row.get("color") or "",
        "sort": int(row.get("sort") or 0),
        "description": row.get("description") or "",
        "status": int(row.get("status") or 0),
        "dictId": int(row.get("dict_id") or 0),
        "createUserString": row.get("create_user_string") or "",
        "createTime": format_time(ct) if isinstance(ct, datetime) else "",
        "updateUserString": row.get("update_user_string") or "",
        "updateTime": format_time(ut) if isinstance(ut, datetime) else "",
    }


@router.get("/system/dict/list")
def list_dict(description: Optional[str] = None, db: Session = Depends(get_db)):
    desc = (description or "").strip()

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    stmt = (
        select(
            SysDict.id,
            SysDict.name,
            SysDict.code,
            func.coalesce(SysDict.description, ""),
            func.coalesce(SysDict.is_system, False),
            SysDict.create_time,
            func.coalesce(cu.nickname, ""),
            SysDict.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysDict)
        .join(cu, cu.id == SysDict.create_user, isouter=True)
        .join(uu, uu.id == SysDict.update_user, isouter=True)
        .order_by(SysDict.create_time.desc(), SysDict.id.desc())
    )
    if desc:
        like = f"%{desc}%"
        stmt = stmt.where(
            func.lower(SysDict.name).like(func.lower(like))
            | func.lower(func.coalesce(SysDict.description, "")).like(func.lower(like))
        )

    rows = db.execute(stmt).all()
    out = []
    for r in rows:
        out.append(
            _dict_resp(
                {
                    "id": r[0],
                    "name": r[1],
                    "code": r[2],
                    "description": r[3],
                    "is_system": r[4],
                    "create_time": r[5],
                    "create_user_string": r[6],
                    "update_time": r[7],
                    "update_user_string": r[8],
                }
            )
        )
    return ok(out)


@router.post("/system/dict")
def create_dict(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err
    name, err = require_non_empty_str(body.get("name"), "名称和编码不能为空")
    if err is not None:
        return err
    code, err = require_non_empty_str(body.get("code"), "名称和编码不能为空")
    if err is not None:
        return err
    description = str(body.get("description") or "").strip()
    return dict_service.create_dict(
        db=db, user_id=int(user_id), name=name or "", code=code or "", description=description
    )


@router.delete("/system/dict")
def delete_dict(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err
    ids, err = parse_positive_int_list(body.get("ids"), "ID 列表不能为空")
    if err is not None:
        return err
    return dict_service.delete_dicts(db=db, ids=ids)


@router.delete("/system/dict/cache/{code}")
def clear_dict_cache(code: str):
    _ = code
    return ok(True)


@router.get("/system/dict/item")
def list_dict_item(request: Request, db: Session = Depends(get_db)):
    dict_id_str = (request.query_params.get("dictId") or "").strip()
    description = (request.query_params.get("description") or "").strip()
    status_str = (request.query_params.get("status") or "").strip()

    dict_id: Optional[int] = None
    if dict_id_str:
        try:
            v = int(dict_id_str)
            if v <= 0:
                return fail("400", "字典 ID 不正确")
            dict_id = v
        except Exception:
            return fail("400", "字典 ID 不正确")

    page, size = parse_page_size(
        request.query_params.get("page"),
        request.query_params.get("size"),
        default_page=1,
        default_size=10,
        min_page=1,
        min_size=1,
    )

    status: Optional[int] = None
    if status_str:
        try:
            v = int(status_str)
            if v != 0:
                status = v
        except Exception:
            status = None

    cu = aliased(SysUser)
    uu = aliased(SysUser)

    stmt = (
        select(
            SysDictItem.id,
            SysDictItem.label,
            SysDictItem.value,
            func.coalesce(SysDictItem.color, ""),
            func.coalesce(SysDictItem.sort, 999),
            func.coalesce(SysDictItem.description, ""),
            SysDictItem.status,
            SysDictItem.dict_id,
            SysDictItem.create_time,
            func.coalesce(cu.nickname, ""),
            SysDictItem.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysDictItem)
        .join(cu, cu.id == SysDictItem.create_user, isouter=True)
        .join(uu, uu.id == SysDictItem.update_user, isouter=True)
    )
    if dict_id is not None:
        stmt = stmt.where(SysDictItem.dict_id == dict_id)
    if description:
        like = f"%{description}%"
        stmt = stmt.where(
            func.lower(SysDictItem.label).like(func.lower(like))
            | func.lower(func.coalesce(SysDictItem.description, "")).like(func.lower(like))
        )
    if status is not None and status != 0:
        stmt = stmt.where(SysDictItem.status == int(status))

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    if int(total or 0) == 0:
        return ok({"list": [], "total": 0})

    rows = db.execute(
        stmt.order_by(SysDictItem.sort.asc(), SysDictItem.id.asc()).limit(int(size)).offset(int((page - 1) * size))
    ).all()

    out = []
    for r in rows:
        out.append(
            _dict_item_resp(
                {
                    "id": r[0],
                    "label": r[1],
                    "value": r[2],
                    "color": r[3],
                    "sort": r[4],
                    "description": r[5],
                    "status": r[6],
                    "dict_id": r[7],
                    "create_time": r[8],
                    "create_user_string": r[9],
                    "update_time": r[10],
                    "update_user_string": r[11],
                }
            )
        )
    return ok({"list": out, "total": int(total)})


@router.get("/system/dict/item/{id}")
def get_dict_item(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    row = db.execute(
        select(
            SysDictItem.id,
            SysDictItem.label,
            SysDictItem.value,
            func.coalesce(SysDictItem.color, ""),
            func.coalesce(SysDictItem.sort, 999),
            func.coalesce(SysDictItem.description, ""),
            SysDictItem.status,
            SysDictItem.dict_id,
            SysDictItem.create_time,
            func.coalesce(cu.nickname, ""),
            SysDictItem.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysDictItem)
        .join(cu, cu.id == SysDictItem.create_user, isouter=True)
        .join(uu, uu.id == SysDictItem.update_user, isouter=True)
        .where(SysDictItem.id == int(id))
        .limit(1)
    ).first()
    if row is None:
        return fail("404", "字典项不存在")
    return ok(
        _dict_item_resp(
            {
                "id": row[0],
                "label": row[1],
                "value": row[2],
                "color": row[3],
                "sort": row[4],
                "description": row[5],
                "status": row[6],
                "dict_id": row[7],
                "create_time": row[8],
                "create_user_string": row[9],
                "update_time": row[10],
                "update_user_string": row[11],
            }
        )
    )


@router.post("/system/dict/item")
def create_dict_item(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err

    label = str(body.get("label") or "").strip()
    value = str(body.get("value") or "").strip()
    color = str(body.get("color") or "").strip()
    description = str(body.get("description") or "").strip()

    sort_val, err = parse_int(body.get("sort"), "请求参数不正确", default=0)
    if err is not None:
        return err
    status, err = parse_int(body.get("status"), "请求参数不正确", default=0)
    if err is not None:
        return err
    dict_id, err = parse_int(body.get("dictId"), "请求参数不正确", default=0)
    if err is not None:
        return err

    return dict_service.create_dict_item(
        db=db,
        user_id=int(user_id),
        label=label,
        value=value,
        color=color,
        description=description,
        sort_val=int(sort_val or 0),
        status=int(status or 0),
        dict_id=int(dict_id or 0),
    )


@router.put("/system/dict/item/{id}")
def update_dict_item(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err
    if id <= 0:
        return fail("400", "ID 参数不正确")

    label = str(body.get("label") or "").strip()
    value = str(body.get("value") or "").strip()
    color = str(body.get("color") or "").strip()
    description = str(body.get("description") or "").strip()

    sort_val, err = parse_int(body.get("sort"), "请求参数不正确", default=0)
    if err is not None:
        return err
    status, err = parse_int(body.get("status"), "请求参数不正确", default=0)
    if err is not None:
        return err

    return dict_service.update_dict_item(
        db=db,
        user_id=int(user_id),
        item_id=int(id),
        label=label,
        value=value,
        color=color,
        description=description,
        sort_val=int(sort_val or 0),
        status=int(status or 0),
    )


@router.delete("/system/dict/item")
def delete_dict_item(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err
    ids, err = parse_positive_int_list(body.get("ids"), "ID 列表不能为空")
    if err is not None:
        return err
    return dict_service.delete_dict_items(db=db, ids=ids)


@router.get("/system/dict/{id}")
def get_dict(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    row = db.execute(
        select(
            SysDict.id,
            SysDict.name,
            SysDict.code,
            func.coalesce(SysDict.description, ""),
            func.coalesce(SysDict.is_system, False),
            SysDict.create_time,
            func.coalesce(cu.nickname, ""),
            SysDict.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysDict)
        .join(cu, cu.id == SysDict.create_user, isouter=True)
        .join(uu, uu.id == SysDict.update_user, isouter=True)
        .where(SysDict.id == int(id))
        .limit(1)
    ).first()
    if row is None:
        return fail("404", "字典不存在")
    return ok(
        _dict_resp(
            {
                "id": row[0],
                "name": row[1],
                "code": row[2],
                "description": row[3],
                "is_system": row[4],
                "create_time": row[5],
                "create_user_string": row[6],
                "update_time": row[7],
                "update_user_string": row[8],
            }
        )
    )


@router.put("/system/dict/{id}")
def update_dict(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    body, err = require_dict_body(body)
    if err is not None:
        return err
    name, err = require_non_empty_str(body.get("name"), "名称不能为空")
    if err is not None:
        return err
    description = str(body.get("description") or "").strip()
    return dict_service.update_dict(
        db=db,
        user_id=int(user_id),
        dict_id=int(id),
        name=name or "",
        description=description,
    )
