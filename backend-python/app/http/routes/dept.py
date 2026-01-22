"""部门管理接口：/system/dept/*（对齐 backend-go/internal/interfaces/http/dept_handler.go）。"""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from fastapi.responses import Response
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, aliased

from app.core.id import next_id
from app.db.models.sys_dept import SysDept
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time_rfc3339


router = APIRouter()


def _dept_row_to_resp(row: dict) -> dict:
    ct = row.get("create_time")
    ut = row.get("update_time")
    return {
        "id": int(row.get("id") or 0),
        "name": row.get("name") or "",
        "sort": int(row.get("sort") or 0),
        "status": int(row.get("status") or 0),
        "isSystem": bool(row.get("is_system") or False),
        "description": row.get("description") or "",
        "createUserString": row.get("create_user_string") or "",
        "createTime": format_time_rfc3339(ct) if isinstance(ct, datetime) else "",
        "updateUserString": row.get("update_user_string") or "",
        "updateTime": format_time_rfc3339(ut) if isinstance(ut, datetime) else "",
        "parentId": int(row.get("parent_id") or 0),
        "children": [],
    }


def _query_dept_list(db: Session, description: str, status: int) -> list[dict]:
    description = (description or "").strip()

    where = []
    if description:
        like = f"%{description}%"
        where.append(func.lower(SysDept.name).like(func.lower(like)))
        where.append(func.lower(func.coalesce(SysDept.description, "")).like(func.lower(like)))

    cu = aliased(SysUser)
    uu = aliased(SysUser)

    stmt = (
        select(
            SysDept.id,
            SysDept.name,
            SysDept.parent_id,
            SysDept.sort,
            SysDept.status,
            SysDept.is_system,
            func.coalesce(SysDept.description, ""),
            SysDept.create_time,
            func.coalesce(cu.nickname, ""),
            SysDept.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysDept)
        .join(cu, cu.id == SysDept.create_user, isouter=True)
        .join(uu, uu.id == SysDept.update_user, isouter=True)
        .order_by(SysDept.sort.asc(), SysDept.id.asc())
    )

    if description:
        stmt = stmt.where(where[0] | where[1])
    if status != 0:
        stmt = stmt.where(SysDept.status == int(status))

    rows = db.execute(stmt).all()
    out: list[dict] = []
    for r in rows:
        out.append(
            {
                "id": r[0],
                "name": r[1],
                "parent_id": r[2],
                "sort": r[3],
                "status": r[4],
                "is_system": r[5],
                "description": r[6],
                "create_time": r[7],
                "create_user_string": r[8],
                "update_time": r[9],
                "update_user_string": r[10],
            }
        )
    return out


@router.get("/system/dept/tree")
def list_dept_tree(request: Request, db: Session = Depends(get_db)):
    desc = (request.query_params.get("description") or "").strip()
    status_str = (request.query_params.get("status") or "").strip()

    status = 0
    if status_str:
        try:
            v = int(status_str)
            if v > 0:
                status = v
        except Exception:
            status = 0

    flat_rows = _query_dept_list(db, desc, status)
    if not flat_rows:
        return ok([])

    node_map: dict[int, dict] = {}
    ordered_ids: list[int] = []
    for d in flat_rows:
        did = int(d["id"])
        ordered_ids.append(did)
        node_map[did] = _dept_row_to_resp(d)

    roots: list[dict] = []
    for did in ordered_ids:
        node = node_map.get(did)
        if node is None:
            continue
        pid = int(node.get("parentId") or 0)
        if pid == 0:
            roots.append(node)
            continue
        parent = node_map.get(pid)
        if parent is None:
            roots.append(node)
            continue
        parent["children"].append(node)

    return ok(roots)


@router.get("/system/dept/{id}")
def get_dept(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "无效的部门 ID")

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    row = db.execute(
        select(
            SysDept.id,
            SysDept.name,
            SysDept.parent_id,
            SysDept.sort,
            SysDept.status,
            SysDept.is_system,
            func.coalesce(SysDept.description, ""),
            SysDept.create_time,
            func.coalesce(cu.nickname, ""),
            SysDept.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysDept)
        .join(cu, cu.id == SysDept.create_user, isouter=True)
        .join(uu, uu.id == SysDept.update_user, isouter=True)
        .where(SysDept.id == int(id))
        .limit(1)
    ).first()
    if row is None:
        return fail("404", "部门不存在")

    item = _dept_row_to_resp(
        {
            "id": row[0],
            "name": row[1],
            "parent_id": row[2],
            "sort": row[3],
            "status": row[4],
            "is_system": row[5],
            "description": row[6],
            "create_time": row[7],
            "create_user_string": row[8],
            "update_time": row[9],
            "update_user_string": row[10],
        }
    )
    item["children"] = []
    return ok(item)


@router.post("/system/dept")
def create_dept(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "参数错误")

    name = str(body.get("name") or "").strip()
    parent_id = int(body.get("parentId") or 0)
    sort_val = int(body.get("sort") or 0)
    status = int(body.get("status") or 0)
    description = str(body.get("description") or "").strip()

    if name == "":
        return fail("400", "名称不能为空")
    if parent_id == 0:
        return fail("400", "上级部门不能为空")
    if sort_val <= 0:
        sort_val = 1
    if status == 0:
        status = 1

    exists = db.execute(
        select(SysDept.id).where(SysDept.parent_id == parent_id).where(SysDept.name == name).limit(1)
    ).first()
    if exists is not None:
        return fail("400", "新增失败，该名称在当前上级下已存在")

    parent_ok = db.execute(select(SysDept.id).where(SysDept.id == parent_id).limit(1)).first()
    if parent_ok is None:
        return fail("400", "上级部门不存在")

    did = next_id()
    if did <= 0:
        return fail("500", "生成部门 ID 失败")
    now = datetime.now()

    try:
        db.add(
            SysDept(
                id=did,
                name=name,
                parent_id=parent_id,
                sort=sort_val,
                status=status,
                is_system=False,
                description=description or None,
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增部门失败")

    return ok(True)


@router.put("/system/dept/{id}")
def update_dept(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "无效的部门 ID")
    if not isinstance(body, dict):
        return fail("400", "参数错误")

    name = str(body.get("name") or "").strip()
    parent_id = int(body.get("parentId") or 0)
    sort_val = int(body.get("sort") or 0)
    status = int(body.get("status") or 0)
    description = str(body.get("description") or "").strip()

    if name == "":
        return fail("400", "名称不能为空")
    if parent_id == 0:
        return fail("400", "上级部门不能为空")
    if sort_val <= 0:
        sort_val = 1
    if status == 0:
        status = 1

    meta = db.execute(select(SysDept.name, SysDept.parent_id, SysDept.is_system).where(SysDept.id == int(id))).first()
    if meta is None:
        return fail("404", "部门不存在")
    old_name = str(meta[0] or "")
    old_parent = int(meta[1] or 0)
    is_system = bool(meta[2])

    if is_system:
        if status == 2:
            return fail("400", f"[{old_name}] 是系统内置部门，不允许禁用")
        if parent_id != old_parent:
            return fail("400", f"[{old_name}] 是系统内置部门，不允许变更上级部门")

    exists = db.execute(
        select(SysDept.id)
        .where(SysDept.parent_id == parent_id)
        .where(SysDept.name == name)
        .where(SysDept.id != int(id))
        .limit(1)
    ).first()
    if exists is not None:
        return fail("400", "修改失败，该名称在当前上级下已存在")

    parent_ok = db.execute(select(SysDept.id).where(SysDept.id == parent_id).limit(1)).first()
    if parent_ok is None:
        return fail("400", "上级部门不存在")

    now = datetime.now()
    try:
        db.execute(
            update(SysDept)
            .where(SysDept.id == int(id))
            .values(
                name=name,
                parent_id=parent_id,
                sort=sort_val,
                status=status,
                description=description,
                update_user=int(user_id),
                update_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改部门失败")

    return ok(True)


@router.delete("/system/dept")
def delete_dept(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
):
    if not isinstance(body, dict) or not isinstance(body.get("ids"), list) or len(body["ids"]) == 0:
        return fail("400", "参数错误")
    ids = []
    for v in body["ids"]:
        try:
            iv = int(v)
            if iv > 0:
                ids.append(iv)
        except Exception:
            continue
    ids = list(dict.fromkeys(ids))
    if not ids:
        return fail("400", "参数错误")

    sys_row = db.execute(select(SysDept.name).where(SysDept.id.in_(ids)).where(SysDept.is_system.is_(True)).limit(1)).first()
    if sys_row is not None:
        return fail("400", f"所选部门 [{sys_row[0]}] 是系统内置部门，不允许删除")

    child_row = db.execute(select(SysDept.id).where(SysDept.parent_id.in_(ids)).limit(1)).first()
    if child_row is not None:
        return fail("400", "所选部门存在下级部门，不允许删除")

    user_row = db.execute(select(SysUser.id).where(SysUser.dept_id.in_(ids)).limit(1)).first()
    if user_row is not None:
        return fail("400", "所选部门存在用户关联，请解除关联后重试")

    try:
        db.execute(delete(SysDept).where(SysDept.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除部门失败")
    return ok(True)


@router.get("/system/dept/export")
def export_dept(request: Request, db: Session = Depends(get_db)):
    desc = (request.query_params.get("description") or "").strip()
    status_str = (request.query_params.get("status") or "").strip()

    status = 0
    if status_str:
        try:
            v = int(status_str)
            if v > 0:
                status = v
        except Exception:
            status = 0

    try:
        flat_rows = _query_dept_list(db, desc, status)
    except Exception:
        return fail("500", "导出部门失败")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ID", "名称", "上级部门ID", "状态", "排序", "系统内置", "描述", "创建时间", "创建人", "修改时间", "修改人"])
    for row in flat_rows:
        writer.writerow(
            [
                str(int(row.get("id") or 0)),
                row.get("name") or "",
                str(int(row.get("parent_id") or 0)),
                str(int(row.get("status") or 0)),
                str(int(row.get("sort") or 0)),
                "true" if bool(row.get("is_system")) else "false",
                row.get("description") or "",
                format_time_rfc3339(row.get("create_time")),
                row.get("create_user_string") or "",
                format_time_rfc3339(row.get("update_time")),
                row.get("update_user_string") or "",
            ]
        )

    content = buf.getvalue()
    headers = {"Content-Disposition": 'attachment; filename="dept_export.csv"'}
    return Response(content=content, media_type="text/csv; charset=utf-8", headers=headers)
