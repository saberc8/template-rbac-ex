"""公共接口：/common/*（对齐 backend-go/internal/interfaces/http/common_handler.go）。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from app.db.models.sys_dept import SysDept
from app.db.models.sys_dict import SysDict
from app.db.models.sys_dict_item import SysDictItem
from app.db.models.sys_menu import SysMenu
from app.db.models.sys_option import SysOption
from app.db.models.sys_role import SysRole
from app.db.models.sys_user import SysUser
from app.http.deps import get_db
from app.http.response import ok


router = APIRouter()


def _has_frontend_column(db: Session) -> bool:
    try:
        cols = inspect(db.get_bind()).get_columns("sys_menu")
    except Exception:
        return False
    return any(str(c.get("name") or "") == "frontend" for c in cols)


@router.get("/common/dict/option/site")
def list_site_options(db: Session = Depends(get_db)):
    rows = db.execute(
        select(SysOption.code, func.coalesce(SysOption.value, SysOption.default_value, ""))
        .where(SysOption.category == "SITE")
        .order_by(SysOption.id.asc())
    ).all()
    out = [{"label": str(code), "value": str(val or "")} for code, val in rows]
    return ok(out)


@router.get("/common/tree/menu")
def list_menu_tree(db: Session = Depends(get_db)):
    stmt = select(SysMenu.id, SysMenu.title, SysMenu.parent_id, SysMenu.status, SysMenu.type).order_by(SysMenu.sort.asc(), SysMenu.id.asc())
    if _has_frontend_column(db):
        stmt = stmt.where(SysMenu.frontend == "vue3")
    rows = db.execute(stmt).all()

    nodes: dict[int, dict] = {}
    ordered_ids: list[int] = []
    for r in rows:
        typ = int(r.type or 0)
        if typ not in (1, 2):
            continue
        mid = int(r.id)
        ordered_ids.append(mid)
        nodes[mid] = {
            "key": mid,
            "title": r.title,
            "disabled": int(r.status or 0) != 1,
            "children": [],
            "_parentId": int(r.parent_id or 0),
        }

    roots: list[dict] = []
    for mid in ordered_ids:
        node = nodes.get(mid)
        if node is None:
            continue
        pid = int(node.get("_parentId") or 0)
        if pid == 0:
            roots.append(node)
            continue
        parent = nodes.get(pid)
        if parent is None:
            roots.append(node)
            continue
        parent["children"].append(node)

    def _strip_meta(n: dict) -> dict:
        children = n.get("children") or []
        return {
            "key": n.get("key"),
            "title": n.get("title"),
            "disabled": bool(n.get("disabled")),
            "children": [_strip_meta(c) for c in children] if children else [],
        }

    out = [_strip_meta(n) for n in roots]
    return ok(out)


@router.get("/common/tree/dept")
def list_dept_tree(db: Session = Depends(get_db)):
    rows = db.execute(select(SysDept.id, SysDept.name, SysDept.parent_id).order_by(SysDept.sort.asc(), SysDept.id.asc())).all()
    nodes: dict[int, dict] = {}
    ordered_ids: list[int] = []
    for r in rows:
        did = int(r.id)
        ordered_ids.append(did)
        nodes[did] = {"key": did, "title": r.name, "disabled": False, "children": [], "_parentId": int(r.parent_id or 0)}

    roots: list[dict] = []
    for did in ordered_ids:
        node = nodes.get(did)
        if node is None:
            continue
        pid = int(node.get("_parentId") or 0)
        if pid == 0:
            roots.append(node)
            continue
        parent = nodes.get(pid)
        if parent is None:
            roots.append(node)
            continue
        parent["children"].append(node)

    def _strip(n: dict) -> dict:
        children = n.get("children") or []
        return {
            "key": n.get("key"),
            "title": n.get("title"),
            "disabled": False,
            "children": [_strip(c) for c in children] if children else [],
        }

    return ok([_strip(n) for n in roots])


@router.get("/common/dict/user")
def list_user_dict(status: Optional[str] = None, db: Session = Depends(get_db)):
    status_filter: Optional[int] = None
    raw = (status or "").strip()
    if raw != "":
        try:
            v = int(raw)
            if v > 0:
                status_filter = v
        except Exception:
            status_filter = None

    if status_filter is None:
        status_filter = 1

    rows = db.execute(
        select(SysUser.id, SysUser.username, SysUser.nickname)
        .where(SysUser.status == status_filter)
        .order_by(SysUser.id.desc())
    ).all()
    out = [{"label": (r.nickname or r.username or ""), "value": int(r.id), "extra": r.username} for r in rows]
    return ok(out)


@router.get("/common/dict/role")
def list_role_dict(db: Session = Depends(get_db)):
    rows = db.execute(select(SysRole.id, SysRole.name, SysRole.code).order_by(SysRole.sort.asc(), SysRole.id.asc())).all()
    out = [{"label": r.name, "value": int(r.id), "extra": r.code} for r in rows]
    return ok(out)


@router.get("/common/dict/{code}")
def list_dict_by_code(code: str, db: Session = Depends(get_db)):
    code = (code or "").strip()
    if code == "":
        return ok([])

    rows = db.execute(
        select(SysDictItem.label, SysDictItem.value, func.coalesce(SysDictItem.color, ""))
        .select_from(SysDictItem)
        .join(SysDict, SysDict.id == SysDictItem.dict_id, isouter=True)
        .where(SysDict.code == code)
        .where(SysDictItem.status == 1)
        .order_by(SysDictItem.sort.asc(), SysDictItem.id.asc())
    ).all()
    out = [{"label": str(r[0]), "value": r[1], "extra": str(r[2] or "")} for r in rows]
    return ok(out)
