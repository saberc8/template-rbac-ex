"""角色管理接口：/system/role/*（对齐 backend-go/internal/interfaces/http/role_handler.go）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.db.models.sys_dept import SysDept
from app.db.models.sys_menu import SysMenu
from app.db.models.sys_role import SysRole
from app.db.models.sys_role_dept import SysRoleDept
from app.db.models.sys_role_menu import SysRoleMenu
from app.db.models.sys_user import SysUser
from app.db.models.sys_user_role import SysUserRole
from app.http.deps import get_db, require_user_id
from app.http.frontend import active_frontend, has_frontend_column
from app.http.response import fail, ok
from app.http.utils import format_time
from app.http.validators import parse_page_size, parse_positive_int_list, require_dict_body, require_list
from app.services import role_service

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
def get_role(id: int, request: Request, db: Session = Depends(get_db)):
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

    frontend = active_frontend(db, request) if has_frontend_column(db) else None
    if frontend is not None:
        menu_ids = [
            int(r[0])
            for r in db.execute(
                select(SysRoleMenu.menu_id)
                .select_from(SysRoleMenu)
                .join(SysMenu, SysMenu.id == SysRoleMenu.menu_id)
                .where(SysRoleMenu.role_id == int(id))
                .where(SysMenu.frontend == frontend)
            ).all()
        ]
    else:
        menu_ids = [
            int(r[0]) for r in db.execute(select(SysRoleMenu.menu_id).where(SysRoleMenu.role_id == int(id))).all()
        ]
    dept_ids = [int(r[0]) for r in db.execute(select(SysRoleDept.dept_id).where(SysRoleDept.role_id == int(id))).all()]

    resp = dict(base)
    resp.update(
        {
            "menuIds": [str(x) for x in menu_ids] if frontend == "react" else menu_ids,
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
    body, err = require_dict_body(body)
    if err is not None:
        return err
    return role_service.create_role(db=db, user_id=user_id, body=body)


@router.put("/system/role/{id}")
def update_role(
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
    return role_service.update_role(db=db, user_id=user_id, role_id=int(id), body=body)


@router.delete("/system/role")
def delete_role(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "ID 列表不能为空")
    role_ids, err = parse_positive_int_list(body.get("ids"), "ID 列表不能为空")
    if err is not None:
        return err
    return role_service.delete_roles(db=db, ids=role_ids)


@router.put("/system/role/{id}/permission")
def update_role_permission(
    id: int,
    request: Request,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    body, err = require_dict_body(body)
    if err is not None:
        return err

    frontend = active_frontend(db, request)
    return role_service.update_role_permission(db=db, user_id=user_id, role_id=int(id), frontend=frontend, body=body)


@router.get("/system/role/{id}/user")
def page_role_user(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    page, size = parse_page_size(
        request.query_params.get("page"),
        request.query_params.get("size"),
        default_page=1,
        default_size=10,
        min_page=1,
        min_size=1,
    )

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
    body_list, err = require_list(body, "用户ID列表不能为空")
    if err is not None:
        return err
    return role_service.assign_to_users(db=db, role_id=int(id), body=body_list)


@router.delete("/system/role/user")
def unassign_from_users(
    body: Optional[list] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    body_list, err = require_list(body, "用户角色ID列表不能为空")
    if err is not None:
        return err
    return role_service.unassign_from_users(db=db, body=body_list)


@router.get("/system/role/{id}/user/id")
def list_role_user_ids(id: int, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    rows = db.execute(select(SysUserRole.user_id).where(SysUserRole.role_id == int(id))).all()
    return ok([int(r[0]) for r in rows])
