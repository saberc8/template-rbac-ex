"""用户信息与路由树聚合（对齐 backend-go/internal/application/auth/user_query_service.go）。"""

from __future__ import annotations

from typing import Any

from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.db.models.sys_menu import SysMenu
from app.db.models.sys_role import SysRole
from app.db.models.sys_role_menu import SysRoleMenu
from app.db.models.sys_user import SysUser
from app.db.models.sys_user_role import SysUserRole
from app.http.frontend import has_frontend_column as _has_frontend_column
from app.http.utils import format_time


def _str_or_empty(v) -> str:
    return "" if v is None else str(v)


def get_user_info(db: Session, user_id: int, *, frontend: str | None = None) -> dict:
    if user_id <= 0:
        raise ValueError("unauthorized")

    user = db.execute(select(SysUser).where(SysUser.id == user_id).limit(1)).scalar_one_or_none()
    if user is None:
        raise ValueError("unauthorized")

    roles_rows = db.execute(
        select(SysRole.id, SysRole.code)
        .join(SysUserRole, SysUserRole.role_id == SysRole.id)
        .where(SysUserRole.user_id == user_id)
    ).all()
    role_codes = [_str_or_empty(r.code) for r in roles_rows if _str_or_empty(r.code) != ""]

    stmt = (
        select(distinct(SysMenu.permission))
        .select_from(SysMenu)
        .join(SysRoleMenu, SysRoleMenu.menu_id == SysMenu.id, isouter=True)
        .join(SysUserRole, SysUserRole.role_id == SysRoleMenu.role_id, isouter=True)
        .where(SysUserRole.user_id == user_id)
        .where(SysMenu.status == 1)
        .where(SysMenu.permission.is_not(None))
    )
    if frontend is not None and _has_frontend_column(db):
        v = str(frontend or "").strip().lower()
        if v in {"vue3", "react"}:
            stmt = stmt.where(SysMenu.frontend == v)
    perms_rows = db.execute(stmt).all()
    permissions = [str(r[0]) for r in perms_rows if r[0] is not None and str(r[0]).strip() != ""]

    pwd_reset_time = ""
    if user.pwd_reset_time is not None:
        pwd_reset_time = format_time(user.pwd_reset_time)

    reg_date = ""
    if user.create_time is not None:
        try:
            reg_date = user.create_time.strftime("%Y-%m-%d")
        except Exception:
            reg_date = ""

    return {
        "id": int(user.id),
        "username": user.username,
        "nickname": user.nickname,
        "gender": int(user.gender or 0),
        "email": _str_or_empty(user.email),
        "phone": _str_or_empty(user.phone),
        "avatar": _str_or_empty(user.avatar),
        "description": _str_or_empty(user.description),
        "pwdResetTime": pwd_reset_time,
        "pwdExpired": False,
        "registrationDate": reg_date,
        "deptName": "",
        "roles": role_codes,
        "permissions": permissions,
    }


def list_user_route(db: Session, user_id: int) -> list[dict]:
    if user_id <= 0:
        raise ValueError("unauthorized")

    roles = db.execute(
        select(SysRole.id, SysRole.code)
        .join(SysUserRole, SysUserRole.role_id == SysRole.id)
        .where(SysUserRole.user_id == user_id)
    ).all()
    if not roles:
        return []

    role_ids = [int(r.id) for r in roles if int(r.id) > 0]
    role_codes = [str(r.code) for r in roles if r.code is not None and str(r.code).strip() != ""]

    stmt = (
        select(
            SysMenu.id,
            SysMenu.parent_id,
            SysMenu.title,
            SysMenu.type,
            func.coalesce(SysMenu.path, ""),
            func.coalesce(SysMenu.name, ""),
            func.coalesce(SysMenu.component, ""),
            func.coalesce(SysMenu.redirect, ""),
            func.coalesce(SysMenu.icon, ""),
            func.coalesce(SysMenu.is_external, False),
            func.coalesce(SysMenu.is_cache, False),
            func.coalesce(SysMenu.is_hidden, False),
            func.coalesce(SysMenu.permission, ""),
            func.coalesce(SysMenu.sort, 0),
            func.coalesce(SysMenu.status, 1),
        )
        .select_from(SysMenu)
        .join(SysRoleMenu, SysRoleMenu.menu_id == SysMenu.id)
        .where(SysRoleMenu.role_id.in_(role_ids))
    )
    if _has_frontend_column(db):
        stmt = stmt.where(SysMenu.frontend == "vue3")
    menu_rows = db.execute(stmt).all()
    if not menu_rows:
        return []

    menu_map: dict[int, Any] = {}
    for m in menu_rows:
        try:
            menu_id = int(m[0])
        except Exception:
            continue
        menu_map[menu_id] = m

    flat = []
    for m in menu_map.values():
        if int(m[3] or 0) == 3:
            continue
        flat.append(
            {
                "id": int(m[0]),
                "title": m[2],
                "parentId": int(m[1] or 0),
                "type": int(m[3] or 0),
                "path": str(m[4] or ""),
                "name": str(m[5] or ""),
                "component": str(m[6] or ""),
                "redirect": str(m[7] or ""),
                "icon": str(m[8] or ""),
                "isExternal": bool(m[9]),
                "isHidden": bool(m[11]),
                "isCache": bool(m[10]),
                "permission": str(m[12] or ""),
                "roles": role_codes,
                "sort": int(m[13] or 0),
                "status": int(m[14] or 1),
                "children": [],
                "activeMenu": "",
                "alwaysShow": False,
                "breadcrumb": True,
                "showInTabs": True,
                "affix": False,
            }
        )

    flat.sort(key=lambda x: (x.get("sort", 0), x.get("id", 0)))

    node_map: dict[int, dict] = {int(n["id"]): n for n in flat}

    roots: list[dict] = []
    for n in flat:
        pid = int(n.get("parentId") or 0)
        if pid == 0:
            roots.append(n)
            continue
        parent = node_map.get(pid)
        if parent is None:
            roots.append(n)
            continue
        parent["children"].append(n)

    def _sort_children(nodes: list[dict]) -> None:
        for node in nodes:
            if node.get("children"):
                node["children"].sort(key=lambda x: (x.get("sort", 0), x.get("id", 0)))
                _sort_children(node["children"])

    _sort_children(roots)
    return roots
