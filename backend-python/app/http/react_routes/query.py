"""React 兼容接口的数据聚合与适配（复用既有表结构）。"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import distinct, func, inspect, select
from sqlalchemy.orm import Session

from app.db.models.sys_menu import SysMenu
from app.db.models.sys_role import SysRole
from app.db.models.sys_role_menu import SysRoleMenu
from app.db.models.sys_user_role import SysUserRole


def _has_frontend_column(db: Session) -> bool:
    try:
        cols = inspect(db.get_bind()).get_columns("sys_menu")
    except Exception:
        return False
    return any(str(c.get("name") or "") == "frontend" for c in cols)


def has_frontend_column(db: Session) -> bool:
    return _has_frontend_column(db)


def list_user_roles(db: Session, user_id: int) -> tuple[list[dict], list[int]]:
    rows = db.execute(
        select(SysRole.id, SysRole.code)
        .join(SysUserRole, SysUserRole.role_id == SysRole.id)
        .where(SysUserRole.user_id == user_id)
    ).all()
    role_ids: list[int] = []
    roles: list[dict] = []
    for r in rows:
        rid = int(r.id or 0)
        code = str(r.code or "").strip()
        if rid <= 0 or code == "":
            continue
        role_ids.append(rid)
        roles.append({"id": str(rid), "name": code, "code": code})
    role_ids = list(dict.fromkeys(role_ids))
    return roles, role_ids


def list_user_permissions(db: Session, user_id: int) -> list[dict]:
    # 未升级到支持 frontend 字段时，无法与 Vue3 菜单集隔离，避免返回错误菜单权限。
    if not _has_frontend_column(db):
        return []

    stmt = (
        select(distinct(SysMenu.permission))
        .select_from(SysMenu)
        .join(SysRoleMenu, SysRoleMenu.menu_id == SysMenu.id, isouter=True)
        .join(SysUserRole, SysUserRole.role_id == SysRoleMenu.role_id, isouter=True)
        .where(SysUserRole.user_id == user_id)
        .where(SysMenu.status == 1)
        .where(SysMenu.permission.is_not(None))
    )
    stmt = stmt.where(SysMenu.frontend == "react")
    perms_rows = db.execute(stmt).all()
    out: list[dict] = []
    for r in perms_rows:
        code = str(r[0] or "").strip()
        if code == "":
            continue
        out.append({"id": code, "name": code, "code": code})
    return out


def list_menu_tree(db: Session, role_ids: Optional[list[int]] = None) -> list[dict]:
    # 未升级到支持 frontend 字段时，无法与 Vue3 菜单集隔离，直接返回空列表（提示用户执行迁移）。
    if not _has_frontend_column(db):
        return []

    stmt = (
        select(
            SysMenu.id,
            SysMenu.parent_id,
            SysMenu.title,
            SysMenu.type,
            func.coalesce(SysMenu.path, ""),
            func.coalesce(SysMenu.name, ""),
            func.coalesce(SysMenu.component, ""),
            func.coalesce(SysMenu.icon, ""),
            func.coalesce(SysMenu.permission, ""),
            func.coalesce(SysMenu.sort, 0),
            func.coalesce(SysMenu.status, 1),
            func.coalesce(SysMenu.is_hidden, False),
        )
        .select_from(SysMenu)
        .where(SysMenu.status == 1)
    )

    stmt = stmt.where(SysMenu.frontend == "react")

    if role_ids:
        stmt = stmt.join(SysRoleMenu, SysRoleMenu.menu_id == SysMenu.id).where(SysRoleMenu.role_id.in_(role_ids))

    rows = db.execute(stmt).all()

    menu_map: dict[int, Any] = {}
    for m in rows:
        mid = int(m[0] or 0)
        if mid <= 0:
            continue
        menu_map[mid] = m

    flat: list[dict] = []
    for m in menu_map.values():
        typ = int(m[3] or 0)
        if typ == 3:
            continue

        menu_id = int(m[0])
        parent_id = int(m[1] or 0)
        title = str(m[2] or "")
        path = str(m[4] or "")
        name = str(m[5] or "")
        component = str(m[6] or "")
        icon = str(m[7] or "")
        permission = str(m[8] or "").strip()
        sort_val = int(m[9] or 0)
        hidden = bool(m[11] or False)

        code = permission or (name.strip() if name.strip() else title)

        item = {
            "id": str(menu_id),
            "parentId": str(parent_id),
            "name": title,
            "code": code,
            "type": typ if typ in {0, 1, 2, 3} else 2,
            "order": sort_val,
            "path": path or "",
            "component": component or "",
            "icon": icon or None,
            "auth": [permission] if permission else None,
            "hidden": hidden or None,
            "children": [],
        }
        flat.append(item)

    flat.sort(key=lambda x: (int(x.get("order") or 0), int(x.get("id") or 0)))

    node_map: dict[str, dict] = {str(n["id"]): n for n in flat}
    roots: list[dict] = []

    for n in flat:
        pid = str(n.get("parentId") or "0")
        if pid == "0":
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
                node["children"].sort(key=lambda x: (int(x.get("order") or 0), int(x.get("id") or 0)))
                _sort_children(node["children"])

    _sort_children(roots)
    return roots
