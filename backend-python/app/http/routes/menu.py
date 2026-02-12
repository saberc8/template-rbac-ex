"""菜单管理接口：/system/menu/*（对齐 backend-go/internal/interfaces/http/menu_handler.go）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.db.models.sys_menu import SysMenu
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.frontend import active_frontend, has_frontend_column
from app.http.response import fail, ok
from app.http.utils import format_time
from app.http.validators import parse_positive_int_list, require_dict_body
from app.services import menu_service

router = APIRouter()


def _has_frontend_column(db: Session) -> bool:
    return has_frontend_column(db)


def _frontend_from_request(request: Request | None) -> Optional[str]:
    from app.http.frontend import frontend_from_request

    return frontend_from_request(request)


def _active_frontend(db: Session, request: Request | None = None) -> Optional[str]:
    """根据运行配置选择当前菜单数据集。

    - 未升级到 frontend 字段时：返回 None，表示不做过滤
    - 已升级：优先按请求头 X-Admin-Frontend 选择 react/vue3；否则按 ADMIN_FRONTEND_TYPE
    """

    return active_frontend(db, request)


def _to_menu_resp(row: dict) -> dict:
    create_time = row.get("create_time")
    update_time = row.get("update_time")
    return {
        "id": int(row.get("id") or 0),
        "title": row.get("title") or "",
        "parentId": int(row.get("parent_id") or 0),
        "type": int(row.get("type") or 0),
        "path": row.get("path") or "",
        "name": row.get("name") or "",
        "component": row.get("component") or "",
        "redirect": row.get("redirect") or "",
        "icon": row.get("icon") or "",
        "isExternal": bool(row.get("is_external") or False),
        "isCache": bool(row.get("is_cache") or False),
        "isHidden": bool(row.get("is_hidden") or False),
        "permission": row.get("permission") or "",
        "sort": int(row.get("sort") or 0),
        "status": int(row.get("status") or 0),
        "createUserString": row.get("create_user_string") or "",
        "createTime": format_time(create_time) if isinstance(create_time, datetime) else "",
        "updateUserString": row.get("update_user_string") or "",
        "updateTime": format_time(update_time) if isinstance(update_time, datetime) else "",
        "children": [],
    }


def _stringify_tree_ids(nodes: list[dict]) -> list[dict]:
    for n in nodes:
        n["id"] = str(n.get("id") or "0")
        n["parentId"] = str(n.get("parentId") or "0")
        if n.get("children"):
            _stringify_tree_ids(n["children"])
    return nodes


@router.get("/system/menu/tree")
def list_menu_tree(request: Request, db: Session = Depends(get_db)):
    cu = aliased(SysUser)
    uu = aliased(SysUser)
    stmt = (
        select(
            SysMenu.id,
            SysMenu.title,
            SysMenu.parent_id,
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
            SysMenu.create_time,
            func.coalesce(cu.nickname, ""),
            SysMenu.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysMenu)
        .join(cu, cu.id == SysMenu.create_user, isouter=True)
        .join(uu, uu.id == SysMenu.update_user, isouter=True)
        .order_by(SysMenu.sort.asc(), SysMenu.id.asc())
    )
    frontend = _active_frontend(db, request)
    if frontend is not None:
        stmt = stmt.where(SysMenu.frontend == frontend)
    rows = db.execute(stmt).all()

    flat: list[dict] = []
    for r in rows:
        flat.append(
            _to_menu_resp(
                {
                    "id": r[0],
                    "title": r[1],
                    "parent_id": r[2],
                    "type": r[3],
                    "path": r[4],
                    "name": r[5],
                    "component": r[6],
                    "redirect": r[7],
                    "icon": r[8],
                    "is_external": r[9],
                    "is_cache": r[10],
                    "is_hidden": r[11],
                    "permission": r[12],
                    "sort": r[13],
                    "status": r[14],
                    "create_time": r[15],
                    "create_user_string": r[16],
                    "update_time": r[17],
                    "update_user_string": r[18],
                }
            )
        )

    node_map: dict[int, dict] = {int(m["id"]): m for m in flat}
    roots: list[dict] = []

    for m in flat:
        pid = int(m.get("parentId") or 0)
        if pid == 0:
            roots.append(m)
            continue
        parent = node_map.get(pid)
        if parent is None:
            roots.append(m)
            continue
        parent["children"].append(m)

    def _sort_children(nodes: list[dict]) -> None:
        for n in nodes:
            if n.get("children"):
                n["children"].sort(key=lambda x: (int(x.get("sort") or 0), int(x.get("id") or 0)))
                _sort_children(n["children"])

    roots.sort(key=lambda x: (int(x.get("sort") or 0), int(x.get("id") or 0)))
    _sort_children(roots)
    if frontend == "react":
        _stringify_tree_ids(roots)
    return ok(roots)


@router.get("/system/menu/{id}")
def get_menu(id: int, request: Request, db: Session = Depends(get_db)):
    if id <= 0:
        return fail("400", "ID 参数不正确")

    cu = aliased(SysUser)
    uu = aliased(SysUser)
    stmt = (
        select(
            SysMenu.id,
            SysMenu.title,
            SysMenu.parent_id,
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
            SysMenu.create_time,
            func.coalesce(cu.nickname, ""),
            SysMenu.update_time,
            func.coalesce(uu.nickname, ""),
        )
        .select_from(SysMenu)
        .join(cu, cu.id == SysMenu.create_user, isouter=True)
        .join(uu, uu.id == SysMenu.update_user, isouter=True)
        .where(SysMenu.id == id)
        .limit(1)
    )
    frontend = _active_frontend(db, request)
    if frontend is not None:
        stmt = stmt.where(SysMenu.frontend == frontend)
    row = db.execute(stmt).first()
    if row is None:
        return fail("404", "菜单不存在")

    item = _to_menu_resp(
        {
            "id": row[0],
            "title": row[1],
            "parent_id": row[2],
            "type": row[3],
            "path": row[4],
            "name": row[5],
            "component": row[6],
            "redirect": row[7],
            "icon": row[8],
            "is_external": row[9],
            "is_cache": row[10],
            "is_hidden": row[11],
            "permission": row[12],
            "sort": row[13],
            "status": row[14],
            "create_time": row[15],
            "create_user_string": row[16],
            "update_time": row[17],
            "update_user_string": row[18],
        }
    )
    item["children"] = []
    if frontend == "react":
        item["id"] = str(item.get("id") or "0")
        item["parentId"] = str(item.get("parentId") or "0")
    return ok(item)


@router.post("/system/menu")
def create_menu(
    request: Request,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    body, err = require_dict_body(body)
    if err is not None:
        return err

    frontend = _active_frontend(db, request)
    return menu_service.create_menu(db=db, user_id=user_id, body=body, frontend=frontend)


@router.put("/system/menu/{id}")
def update_menu(
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

    frontend = _active_frontend(db, request)
    return menu_service.update_menu(db=db, user_id=user_id, menu_id=int(id), body=body, frontend=frontend)


@router.delete("/system/menu")
def delete_menu(
    request: Request,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "ID 列表不能为空")
    ids, err = parse_positive_int_list(body.get("ids"), "ID 列表不能为空")
    if err is not None:
        return err

    frontend = _active_frontend(db, request)
    return menu_service.delete_menu_tree(db=db, ids=ids, frontend=frontend)


@router.delete("/system/menu/cache")
def clear_menu_cache():
    return ok(True)
