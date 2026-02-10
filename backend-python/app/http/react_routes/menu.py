"""slash-admin(React) 菜单接口：/menu。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.http.deps import get_db, get_user_id
from app.http.react_routes import query
from app.http.react_routes.response import fail, ok

router = APIRouter()


@router.get("/menu")
def list_menu(request: Request, db: Session = Depends(get_db)):
    if not query.has_frontend_column(db):
        return fail("缺少 sys_menu.frontend 字段，请先执行: python -m app.cmd.migrate --seed all")
    uid = get_user_id(request)
    if uid is None:
        tree = query.list_menu_tree(db, role_ids=None)
        return ok(tree)
    _, role_ids = query.list_user_roles(db, int(uid))
    tree = query.list_menu_tree(db, role_ids=role_ids)
    return ok(tree)
