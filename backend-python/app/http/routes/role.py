"""角色管理接口：/system/role/*（对齐 backend-go/internal/interfaces/http/role_handler.go）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, aliased

from app.core.id import next_id
from app.db.models.sys_dept import SysDept
from app.db.models.sys_role import SysRole
from app.db.models.sys_role_dept import SysRoleDept
from app.db.models.sys_role_menu import SysRoleMenu
from app.db.models.sys_user import SysUser
from app.db.models.sys_user_role import SysUserRole
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time

router = APIRouter()


def _to_role_resp(row: dict) -> dict:
    create_time = row.get("create_time")
    update_time = row.get("update_time")
    out = {
        "id": int(row.get("id") or 0),
        "name": row.get("name") or "",
        "code": row.get("code") or "",
        "sort": int(row.get("sort") or 0),
        "description": row.get("description") or "",
        "dataScope": int(row.get("data_scope") or 0),
        "isSystem": bool(row.get("is_system") or False),
        "createUserString": row.get("create_user_string") or "",
        "createTime": format_time(create_time) if isinstance(create_time, datetime) else "",
        "updateUserString": row.get("update_user_string") or "",
        "updateTime": format_time(update_time) if isinstance(update_time, datetime) else "",
        "disabled": False,
    }
    out["disabled"] = out["isSystem"] and out["code"] == "admin"
    return out


@router.get("/system/role/list")
def list_role(description: Optional[str] = None, db: Session = Depends(get_db)):
    desc_filter = (description or "").strip()

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    rows = db.execute(
        select(
            SysRole.id,
            SysRole.name,
            SysRole.code,
            func.coalesce(SysRole.sort, 999),
            func.coalesce(SysRole.description, ""),
            func.coalesce(SysRole.data_scope, 4),
            func.coalesce(SysRole.is_system, False),
            SysRole.create_time,
            func.coalesce(cu.nickname, ""),
            SysRole.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysRole)
        .join(cu, cu.id == SysRole.create_user, isouter=True)
        .join(uu, uu.id == SysRole.update_user, isouter=True)
        .order_by(SysRole.sort.asc(), SysRole.id.asc())
    ).all()

    out: list[dict] = []
    for r in rows:
        item = _to_role_resp(
            {
                "id": r[0],
                "name": r[1],
                "code": r[2],
                "sort": r[3],
                "description": r[4],
                "data_scope": r[5],
                "is_system": r[6],
                "create_time": r[7],
                "create_user_string": r[8],
                "update_time": r[9],
                "update_user_string": r[10],
            }
        )
        if desc_filter == "" or (desc_filter in item["name"] or desc_filter in item["description"]):
            out.append(item)
    return ok(out)


@router.get("/system/role/{id}")
def get_role(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    row = db.execute(
        select(
            SysRole.id,
            SysRole.name,
            SysRole.code,
            func.coalesce(SysRole.sort, 999),
            func.coalesce(SysRole.description, ""),
            func.coalesce(SysRole.data_scope, 4),
            func.coalesce(SysRole.is_system, False),
            func.coalesce(SysRole.menu_check_strictly, True),
            func.coalesce(SysRole.dept_check_strictly, True),
            SysRole.create_time,
            func.coalesce(cu.nickname, ""),
            SysRole.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysRole)
        .join(cu, cu.id == SysRole.create_user, isouter=True)
        .join(uu, uu.id == SysRole.update_user, isouter=True)
        .where(SysRole.id == int(id))
        .limit(1)
    ).first()
    if row is None:
        return fail("404", "角色不存在")

    base = _to_role_resp(
        {
            "id": row[0],
            "name": row[1],
            "code": row[2],
            "sort": row[3],
            "description": row[4],
            "data_scope": row[5],
            "is_system": row[6],
            "create_time": row[9],
            "create_user_string": row[10],
            "update_time": row[11],
            "update_user_string": row[12],
        }
    )
    base["disabled"] = base["isSystem"] and base["code"] == "admin"

    menu_ids = [int(r[0]) for r in db.execute(select(SysRoleMenu.menu_id).where(SysRoleMenu.role_id == int(id))).all()]
    dept_ids = [int(r[0]) for r in db.execute(select(SysRoleDept.dept_id).where(SysRoleDept.role_id == int(id))).all()]

    resp = dict(base)
    resp.update(
        {
            "menuIds": menu_ids,
            "deptIds": dept_ids,
            "menuCheckStrictly": bool(row[7]),
            "deptCheckStrictly": bool(row[8]),
        }
    )
    return ok(resp)


@router.post("/system/role")
def create_role(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    name = str(body.get("name") or "").strip()
    code = str(body.get("code") or "").strip()
    if name == "" or code == "":
        return fail("400", "名称和编码不能为空")

    sort_val = int(body.get("sort") or 0)
    if sort_val <= 0:
        sort_val = 999
    data_scope = int(body.get("dataScope") or 0)
    if data_scope == 0:
        data_scope = 4

    dept_ids_raw = body.get("deptIds") if isinstance(body.get("deptIds"), list) else []
    dept_ids = []
    for v in dept_ids_raw:
        try:
            iv = int(v)
            if iv > 0:
                dept_ids.append(iv)
        except Exception:
            continue
    dept_ids = list(dict.fromkeys(dept_ids))

    dept_check_strict = bool(body.get("deptCheckStrictly") or False)

    rid = next_id()
    if rid <= 0:
        return fail("500", "新增角色失败")
    now = datetime.now()

    try:
        db.add(
            SysRole(
                id=rid,
                name=name,
                code=code,
                data_scope=data_scope,
                description=str(body.get("description") or "").strip() or None,
                sort=sort_val,
                is_system=False,
                menu_check_strictly=True,
                dept_check_strictly=dept_check_strict,
                create_user=int(user_id),
                create_time=now,
            )
        )
        for did in dept_ids:
            db.add(SysRoleDept(role_id=rid, dept_id=did))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增角色失败")

    return ok({"id": rid})


@router.put("/system/role/{id}")
def update_role(
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
    if name == "":
        return fail("400", "名称不能为空")

    sort_val = int(body.get("sort") or 0)
    if sort_val <= 0:
        sort_val = 999
    data_scope = int(body.get("dataScope") or 0)
    if data_scope == 0:
        data_scope = 4

    dept_ids_raw = body.get("deptIds") if isinstance(body.get("deptIds"), list) else []
    dept_ids = []
    for v in dept_ids_raw:
        try:
            iv = int(v)
            if iv > 0:
                dept_ids.append(iv)
        except Exception:
            continue
    dept_ids = list(dict.fromkeys(dept_ids))

    dept_check_strict = bool(body.get("deptCheckStrictly") or False)
    now = datetime.now()

    try:
        db.execute(
            update(SysRole)
            .where(SysRole.id == int(id))
            .values(
                name=name,
                description=str(body.get("description") or "").strip(),
                sort=sort_val,
                data_scope=data_scope,
                dept_check_strictly=dept_check_strict,
                update_user=int(user_id),
                update_time=now,
            )
        )
        db.execute(delete(SysRoleDept).where(SysRoleDept.role_id == int(id)))
        for did in dept_ids:
            db.add(SysRoleDept(role_id=int(id), dept_id=did))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改角色失败")

    return ok(True)


@router.delete("/system/role")
def delete_role(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "ID 列表不能为空")
    ids = body.get("ids")
    if not isinstance(ids, list) or len(ids) == 0:
        return fail("400", "ID 列表不能为空")

    role_ids: list[int] = []
    for v in ids:
        try:
            iv = int(v)
            if iv > 0:
                role_ids.append(iv)
        except Exception:
            continue
    if not role_ids:
        return fail("400", "ID 列表不能为空")

    try:
        db.execute(delete(SysUserRole).where(SysUserRole.role_id.in_(role_ids)))
        db.execute(delete(SysRoleMenu).where(SysRoleMenu.role_id.in_(role_ids)))
        db.execute(delete(SysRoleDept).where(SysRoleDept.role_id.in_(role_ids)))
        db.execute(delete(SysRole).where(SysRole.id.in_(role_ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除角色失败")
    return ok(True)


@router.put("/system/role/{id}/permission")
def update_role_permission(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    menu_ids_raw = body.get("menuIds") if isinstance(body.get("menuIds"), list) else []
    menu_ids: list[int] = []
    for v in menu_ids_raw:
        try:
            iv = int(v)
            if iv > 0:
                menu_ids.append(iv)
        except Exception:
            continue
    menu_ids = list(dict.fromkeys(menu_ids))

    menu_check_strict = bool(body.get("menuCheckStrictly") or False)
    now = datetime.now()

    try:
        db.execute(delete(SysRoleMenu).where(SysRoleMenu.role_id == int(id)))
        for mid in menu_ids:
            db.add(SysRoleMenu(role_id=int(id), menu_id=mid))
        db.execute(
            update(SysRole)
            .where(SysRole.id == int(id))
            .values(menu_check_strictly=menu_check_strict, update_user=int(user_id), update_time=now)
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "保存角色菜单失败")

    return ok(True)


@router.get("/system/role/{id}/user")
def page_role_user(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    try:
        page = int(request.query_params.get("page") or "1")
    except Exception:
        page = 1
    try:
        size = int(request.query_params.get("size") or "10")
    except Exception:
        size = 10
    if page <= 0:
        page = 1
    if size <= 0:
        size = 10

    desc_filter = (request.query_params.get("description") or "").strip()

    dept = aliased(SysDept)
    rows = db.execute(
        select(
            SysUserRole.id,
            SysUserRole.role_id,
            SysUser.id,
            SysUser.username,
            SysUser.nickname,
            SysUser.gender,
            SysUser.status,
            SysUser.is_system,
            func.coalesce(SysUser.description, ""),
            SysUser.dept_id,
            func.coalesce(dept.name, ""),
        )
        .select_from(SysUserRole)
        .join(SysUser, SysUser.id == SysUserRole.user_id)
        .join(dept, dept.id == SysUser.dept_id, isouter=True)
        .where(SysUserRole.role_id == int(id))
        .order_by(SysUserRole.id.desc())
    ).all()

    filtered = []
    if desc_filter == "":
        filtered = rows
    else:
        for r in rows:
            if desc_filter in str(r.username) or desc_filter in str(r.nickname) or desc_filter in str(r[8] or ""):
                filtered.append(r)

    total = len(filtered)
    start = (page - 1) * size
    if start > total:
        start = total
    end = min(start + size, total)
    page_rows = filtered[start:end]

    user_ids = []
    for r in page_rows:
        try:
            uid = int(r[2])
            if uid > 0:
                user_ids.append(uid)
        except Exception:
            continue
    user_ids = list(dict.fromkeys(user_ids))

    role_map: dict[int, list[tuple[int, str]]] = {}
    if user_ids:
        role_rows = db.execute(
            select(SysUserRole.user_id, SysUserRole.role_id, SysRole.name)
            .select_from(SysUserRole)
            .join(SysRole, SysRole.id == SysUserRole.role_id)
            .where(SysUserRole.user_id.in_(user_ids))
        ).all()
        for rr in role_rows:
            uid = int(rr[0])
            role_map.setdefault(uid, []).append((int(rr[1]), str(rr[2] or "")))

    out = []
    for r in page_rows:
        uid = int(r[2])
        roles = role_map.get(uid, [])
        role_ids = [rid for rid, _ in roles]
        role_names = [name for _, name in roles]
        is_system = bool(r[7])
        role_id = int(r[1])
        out.append(
            {
                "id": int(r[0]),
                "roleId": role_id,
                "userId": uid,
                "username": str(r[3] or ""),
                "nickname": str(r[4] or ""),
                "gender": int(r[5] or 0),
                "status": int(r[6] or 0),
                "isSystem": is_system,
                "description": str(r[8] or ""),
                "deptId": int(r[9] or 0),
                "deptName": str(r[10] or ""),
                "roleIds": role_ids,
                "roleNames": role_names,
                "disabled": bool(is_system and role_id == 1),
            }
        )

    return ok({"list": out, "total": int(total)})


@router.post("/system/role/{id}/user")
def assign_to_users(
    id: int,
    body: Optional[list] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, list) or len(body) == 0:
        return fail("400", "用户ID列表不能为空")

    user_ids: list[int] = []
    for v in body:
        try:
            iv = int(v)
            if iv > 0:
                user_ids.append(iv)
        except Exception:
            continue
    user_ids = list(dict.fromkeys(user_ids))
    if not user_ids:
        return ok(True)

    try:
        existing = db.execute(
            select(SysUserRole.user_id).where(SysUserRole.role_id == int(id)).where(SysUserRole.user_id.in_(user_ids))
        ).all()
        existing_set = {int(r[0]) for r in existing}
        for uid in user_ids:
            if uid in existing_set:
                continue
            db.add(SysUserRole(id=next_id(), user_id=uid, role_id=int(id)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "分配用户失败")

    return ok(True)


@router.delete("/system/role/user")
def unassign_from_users(
    body: Optional[list] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if not isinstance(body, list) or len(body) == 0:
        return fail("400", "用户角色ID列表不能为空")

    ids: list[int] = []
    for v in body:
        try:
            iv = int(v)
            if iv > 0:
                ids.append(iv)
        except Exception:
            continue
    if not ids:
        return fail("400", "用户角色ID列表不能为空")

    try:
        db.execute(delete(SysUserRole).where(SysUserRole.id.in_(ids)))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "取消分配失败")
    return ok(True)


@router.get("/system/role/{id}/user/id")
def list_role_user_ids(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    rows = db.execute(select(SysUserRole.user_id).where(SysUserRole.role_id == int(id))).all()
    return ok([int(r[0]) for r in rows])
