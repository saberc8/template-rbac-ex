"""菜单管理接口：/system/menu/*（对齐 backend-go/internal/interfaces/http/menu_handler.go）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import delete, func, inspect, select, update
from sqlalchemy.orm import Session, aliased

from app.core.id import next_id
from app.db.models.sys_menu import SysMenu
from app.db.models.sys_role_menu import SysRoleMenu
from app.db.models.sys_user import SysUser
from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.http.utils import format_time

router = APIRouter()


def _has_frontend_column(db: Session) -> bool:
    try:
        cols = inspect(db.get_bind()).get_columns("sys_menu")
    except Exception:
        return False
    return any(str(c.get("name") or "") == "frontend" for c in cols)


def _build_menu_for_save(menu_id: int, body: dict) -> tuple[Optional[dict], Optional[tuple[str, str]]]:
    typ = int(body.get("type") or 0)
    if typ == 0:
        typ = 1

    title = str(body.get("title") or "").strip()
    if title == "":
        return None, ("400", "菜单标题不能为空")

    is_external = bool(body.get("isExternal")) if body.get("isExternal") is not None else False
    is_cache = bool(body.get("isCache")) if body.get("isCache") is not None else False
    is_hidden = bool(body.get("isHidden")) if body.get("isHidden") is not None else False

    path = str(body.get("path") or "").strip()
    name = str(body.get("name") or "").strip()
    component = str(body.get("component") or "").strip()

    if is_external:
        if path and not (path.startswith("http://") or path.startswith("https://")):
            return None, ("400", "路由地址格式不正确，请以 http:// 或 https:// 开头")
    else:
        if path.startswith("http://") or path.startswith("https://"):
            return None, ("400", "路由地址格式不正确")
        if path != "" and not path.startswith("/"):
            path = "/" + path
        name = name.lstrip("/")
        component = component.lstrip("/")

    sort_val = int(body.get("sort") or 0)
    if sort_val <= 0:
        sort_val = 999

    status = int(body.get("status") or 0)
    if status == 0:
        status = 1

    if menu_id < 0:
        return None, ("400", "ID 参数不正确")

    return (
        {
            "id": menu_id,
            "parent_id": int(body.get("parentId") or 0),
            "type": typ,
            "title": title,
            "path": path or None,
            "name": name or None,
            "component": component or None,
            "redirect": str(body.get("redirect") or "").strip() or None,
            "icon": str(body.get("icon") or "").strip() or None,
            "is_external": is_external,
            "is_cache": is_cache,
            "is_hidden": is_hidden,
            "permission": str(body.get("permission") or "").strip() or None,
            "sort": sort_val,
            "status": status,
        },
        None,
    )


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


@router.get("/system/menu/tree")
def list_menu_tree(db: Session = Depends(get_db)):
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
    if _has_frontend_column(db):
        stmt = stmt.where(SysMenu.frontend == "vue3")
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
    return ok(roots)


@router.get("/system/menu/{id}")
def get_menu(id: int, db: Session = Depends(get_db)):
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
    if _has_frontend_column(db):
        stmt = stmt.where(SysMenu.frontend == "vue3")
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
    return ok(item)


@router.post("/system/menu")
def create_menu(
    request: Request,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    payload, err = _build_menu_for_save(0, body)
    if err is not None:
        return fail(err[0], err[1])

    mid = next_id()
    if mid <= 0:
        return fail("500", "新增菜单失败")

    now = datetime.now()
    try:
        db.add(
            SysMenu(
                id=mid,
                title=payload["title"],
                parent_id=payload["parent_id"],
                type=payload["type"],
                path=payload["path"],
                name=payload["name"],
                component=payload["component"],
                redirect=payload["redirect"],
                icon=payload["icon"],
                is_external=payload["is_external"],
                is_cache=payload["is_cache"],
                is_hidden=payload["is_hidden"],
                permission=payload["permission"],
                sort=payload["sort"],
                status=payload["status"],
                create_user=int(user_id),
                create_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增菜单失败")

    return ok({"id": mid})


@router.put("/system/menu/{id}")
def update_menu(
    id: int,
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    user_id: int = Depends(require_user_id),
):
    if id <= 0:
        return fail("400", "ID 参数不正确")
    if not isinstance(body, dict):
        return fail("400", "请求参数不正确")

    payload, err = _build_menu_for_save(int(id), body)
    if err is not None:
        return fail(err[0], err[1])

    now = datetime.now()
    try:
        stmt = update(SysMenu).where(SysMenu.id == int(id))
        if _has_frontend_column(db):
            stmt = stmt.where(SysMenu.frontend == "vue3")
        db.execute(
            stmt.values(
                parent_id=payload["parent_id"],
                type=payload["type"],
                title=payload["title"],
                path=payload["path"],
                name=payload["name"],
                component=payload["component"],
                redirect=payload["redirect"],
                icon=payload["icon"],
                is_external=payload["is_external"],
                is_cache=payload["is_cache"],
                is_hidden=payload["is_hidden"],
                permission=payload["permission"],
                sort=payload["sort"],
                status=payload["status"],
                update_user=int(user_id),
                update_time=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改菜单失败")

    return ok(True)


@router.delete("/system/menu")
def delete_menu(
    body: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
    _user_id: int = Depends(require_user_id),
):
    if not isinstance(body, dict):
        return fail("400", "ID 列表不能为空")
    ids = body.get("ids")
    if not isinstance(ids, list) or len(ids) == 0:
        return fail("400", "ID 列表不能为空")
    seed_ids = []
    for v in ids:
        try:
            iv = int(v)
            if iv > 0:
                seed_ids.append(iv)
        except Exception:
            continue
    if not seed_ids:
        return fail("400", "ID 列表不能为空")

    stmt = select(SysMenu.id, SysMenu.parent_id)
    if _has_frontend_column(db):
        stmt = stmt.where(SysMenu.frontend == "vue3")
    rows = db.execute(stmt).all()
    children_of: dict[int, list[int]] = {}
    allowed_ids: set[int] = set()
    for r in rows:
        pid = int(r.parent_id or 0)
        mid = int(r.id)
        allowed_ids.add(mid)
        children_of.setdefault(pid, []).append(mid)

    seed_ids = [mid for mid in seed_ids if mid in allowed_ids]
    if not seed_ids:
        return ok(True)

    seen: set[int] = set()

    def collect(mid: int) -> None:
        if mid in seen:
            return
        seen.add(mid)
        for ch in children_of.get(mid, []):
            collect(ch)

    for mid in seed_ids:
        collect(mid)

    all_ids = sorted(seen)
    if not all_ids:
        return ok(True)

    try:
        db.execute(delete(SysRoleMenu).where(SysRoleMenu.menu_id.in_(all_ids)))
        stmt = delete(SysMenu).where(SysMenu.id.in_(all_ids))
        if _has_frontend_column(db):
            stmt = stmt.where(SysMenu.frontend == "vue3")
        db.execute(stmt)
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除菜单失败")

    return ok(True)


@router.delete("/system/menu/cache")
def clear_menu_cache():
    return ok(True)
