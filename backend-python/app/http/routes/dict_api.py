"""字典管理接口：/system/dict/*（对齐 backend-go/internal/interfaces/http/dict_handler.go）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, aliased

from app.core.id import next_id
from app.db.models.sys_dict import SysDict
from app.db.models.sys_dict_item import SysDictItem
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time

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
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")
    name = str(body.get("name") or "").strip()
    code = str(body.get("code") or "").strip()
    description = str(body.get("description") or "").strip()
    if name == "" or code == "":
        return fail("400", "名称和编码不能为空")

    exists = db.execute(select(SysDict.id).where(SysDict.name == name).limit(1)).first()
    if exists is not None:
        return fail("400", f"新增失败，[{name}] 已存在")
    exists = db.execute(select(SysDict.id).where(SysDict.code == code).limit(1)).first()
    if exists is not None:
        return fail("400", f"新增失败，[{code}] 已存在")

    did = next_id()
    if did <= 0:
        return fail("500", "新增字典失败")
    now = datetime.now()
    try:
        db.add(
            SysDict(
                id=did,
                name=name,
                code=code,
                description=description,
                is_system=False,
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增字典失败")
    return ok({"id": did})


@router.delete("/system/dict")
def delete_dict(
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
        db.execute(delete(SysDictItem).where(SysDictItem.dict_id.in_(ids)))
        db.execute(delete(SysDict).where(SysDict.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除字典失败")
    return ok(True)


@router.delete("/system/dict/cache/{code}")
def clear_dict_cache(code: str):
    _ = code
    return ok(True)


@router.get("/system/dict/item")
def list_dict_item(request: Request, db: Session = Depends(get_db)):
    dict_id_str = (request.query_params.get("dictId") or "").strip()
    page_str = (request.query_params.get("page") or "").strip()
    size_str = (request.query_params.get("size") or "").strip()
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

    page = 1
    size = 10
    try:
        if page_str:
            page = int(page_str)
    except Exception:
        page = 1
    try:
        if size_str:
            size = int(size_str)
    except Exception:
        size = 10
    if page <= 0:
        page = 1
    if size <= 0:
        size = 10

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
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    label = str(body.get("label") or "").strip()
    value = str(body.get("value") or "").strip()
    color = str(body.get("color") or "").strip()
    description = str(body.get("description") or "").strip()
    sort_val = int(body.get("sort") or 0)
    status = int(body.get("status") or 0)
    dict_id = int(body.get("dictId") or 0)

    if label == "" or value == "" or dict_id == 0:
        return fail("400", "标签、值和字典 ID 不能为空")
    if sort_val <= 0:
        sort_val = 999
    if status == 0:
        status = 1

    iid = next_id()
    if iid <= 0:
        return fail("500", "新增字典项失败")
    now = datetime.now()
    try:
        db.add(
            SysDictItem(
                id=iid,
                label=label,
                value=value,
                color=color or None,
                sort=sort_val,
                description=description,
                status=status,
                dict_id=dict_id,
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增字典项失败")
    return ok({"id": iid})


@router.put("/system/dict/item/{id}")
def update_dict_item(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    label = str(body.get("label") or "").strip()
    value = str(body.get("value") or "").strip()
    color = str(body.get("color") or "").strip()
    description = str(body.get("description") or "").strip()
    sort_val = int(body.get("sort") or 0)
    status = int(body.get("status") or 0)
    if label == "" or value == "":
        return fail("400", "标签和值不能为空")
    if sort_val <= 0:
        sort_val = 999
    if status == 0:
        status = 1

    now = datetime.now()
    try:
        db.execute(
            update(SysDictItem)
            .where(SysDictItem.id == int(id))
            .values(
                label=label,
                value=value,
                color=color,
                sort=sort_val,
                description=description,
                status=status,
                update_user=int(user_id),
                update_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改字典项失败")
    return ok(True)


@router.delete("/system/dict/item")
def delete_dict_item(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict) or not isinstance(body.get("ids"), list) or len(body["ids"]) == 0:
        return fail("400", "ID 列表不能为空")
    ids: list[int] = []
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
        db.execute(delete(SysDictItem).where(SysDictItem.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除字典项失败")
    return ok(True)


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
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")
    name = str(body.get("name") or "").strip()
    description = str(body.get("description") or "").strip()
    if name == "":
        return fail("400", "名称不能为空")

    now = datetime.now()
    try:
        db.execute(
            update(SysDict)
            .where(SysDict.id == int(id))
            .values(name=name, description=description, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改字典失败")
    return ok(True)
