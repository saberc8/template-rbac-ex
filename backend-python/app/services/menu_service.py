"""菜单用例编排（menu 写接口）。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.id import next_id
from app.db.models.sys_menu import SysMenu
from app.db.models.sys_role_menu import SysRoleMenu
from app.http.response import APIResponse, fail, ok


def _parse_int(v: Any) -> Optional[int]:
    try:
        return int(v)
    except Exception:
        return None


def _build_menu_payload(
    *, menu_id: int, body: dict[str, Any]
) -> tuple[Optional[dict[str, Any]], Optional[APIResponse]]:
    typ = _parse_int(body.get("type") or 0)
    if typ is None:
        return None, fail("400", "请求参数不正确")
    if typ == 0:
        typ = 1

    title = str(body.get("title") or "").strip()
    if title == "":
        return None, fail("400", "菜单标题不能为空")

    is_external = bool(body.get("isExternal")) if body.get("isExternal") is not None else False
    is_cache = bool(body.get("isCache")) if body.get("isCache") is not None else False
    is_hidden = bool(body.get("isHidden")) if body.get("isHidden") is not None else False

    path = str(body.get("path") or "").strip()
    name = str(body.get("name") or "").strip()
    component = str(body.get("component") or "").strip()

    if is_external:
        if path and not (path.startswith("http://") or path.startswith("https://")):
            return None, fail("400", "路由地址格式不正确，请以 http:// 或 https:// 开头")
    else:
        if path.startswith("http://") or path.startswith("https://"):
            return None, fail("400", "路由地址格式不正确")
        if path != "" and not path.startswith("/"):
            path = "/" + path
        name = name.lstrip("/")
        component = component.lstrip("/")

    parent_id = _parse_int(body.get("parentId") or 0)
    if parent_id is None:
        return None, fail("400", "请求参数不正确")

    sort_val = _parse_int(body.get("sort") or 0)
    if sort_val is None:
        return None, fail("400", "请求参数不正确")
    if sort_val <= 0:
        sort_val = 999

    status = _parse_int(body.get("status") or 0)
    if status is None:
        return None, fail("400", "请求参数不正确")
    if status == 0:
        status = 1

    if menu_id < 0:
        return None, fail("400", "ID 参数不正确")

    return (
        {
            "id": menu_id,
            "parent_id": int(parent_id),
            "type": int(typ),
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
            "sort": int(sort_val),
            "status": int(status),
        },
        None,
    )


def create_menu(*, db: Session, user_id: int, body: dict[str, Any], frontend: Optional[str]) -> APIResponse:
    payload, err = _build_menu_payload(menu_id=0, body=body)
    if err is not None:
        return err

    mid = next_id()
    if mid <= 0:
        return fail("500", "新增菜单失败")

    now = datetime.now()
    try:
        menu_kwargs: dict[str, Any] = {
            "id": mid,
            "title": payload["title"],
            "parent_id": payload["parent_id"],
            "type": payload["type"],
            "path": payload["path"],
            "name": payload["name"],
            "component": payload["component"],
            "redirect": payload["redirect"],
            "icon": payload["icon"],
            "is_external": payload["is_external"],
            "is_cache": payload["is_cache"],
            "is_hidden": payload["is_hidden"],
            "permission": payload["permission"],
            "sort": payload["sort"],
            "status": payload["status"],
            "create_user": int(user_id),
            "create_time": now,
        }
        if frontend is not None:
            menu_kwargs["frontend"] = frontend
        db.add(SysMenu(**menu_kwargs))
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "新增菜单失败")

    if frontend == "react":
        return ok({"id": str(mid)})
    return ok({"id": mid})


def update_menu(
    *,
    db: Session,
    user_id: int,
    menu_id: int,
    body: dict[str, Any],
    frontend: Optional[str],
) -> APIResponse:
    if menu_id <= 0:
        return fail("400", "ID 参数不正确")

    payload, err = _build_menu_payload(menu_id=menu_id, body=body)
    if err is not None:
        return err

    now = datetime.now()
    try:
        stmt = update(SysMenu).where(SysMenu.id == int(menu_id))
        if frontend is not None:
            stmt = stmt.where(SysMenu.frontend == frontend)
        res = db.execute(
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
        if int(getattr(res, "rowcount", 0) or 0) <= 0:
            db.rollback()
            return fail("404", "菜单不存在")
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "修改菜单失败")

    return ok(True)


def delete_menu_tree(*, db: Session, ids: list[int], frontend: Optional[str]) -> APIResponse:
    if not ids:
        return ok(True)

    stmt = select(SysMenu.id, SysMenu.parent_id)
    if frontend is not None:
        stmt = stmt.where(SysMenu.frontend == frontend)
    rows = db.execute(stmt).all()

    children_of: dict[int, list[int]] = {}
    allowed_ids: set[int] = set()
    for r in rows:
        pid = int(r.parent_id or 0)
        mid = int(r.id)
        allowed_ids.add(mid)
        children_of.setdefault(pid, []).append(mid)

    seed_ids = [mid for mid in ids if mid in allowed_ids]
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
        if frontend is not None:
            stmt = stmt.where(SysMenu.frontend == frontend)
        db.execute(stmt)
        db.commit()
    except Exception:
        db.rollback()
        return fail("500", "删除菜单失败")

    return ok(True)
