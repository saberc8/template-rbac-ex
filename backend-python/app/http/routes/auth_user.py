"""用户信息与路由：/auth/user/info /auth/user/route。"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.http.deps import get_db, require_user_id
from app.http.response import fail, ok
from app.services import user_query

router = APIRouter()


@router.get("/auth/user/info")
def get_user_info(
    user_id: int = Depends(require_user_id),
    db: Session = Depends(get_db),
):
    try:
        info = user_query.get_user_info(db, int(user_id))
    except ValueError:
        return fail("401", "未授权，请重新登录")
    except Exception:
        return fail("500", "服务未初始化")
    return ok(info)


@router.get("/auth/user/route")
def list_user_route(
    user_id: int = Depends(require_user_id),
    db: Session = Depends(get_db),
):
    try:
        tree = user_query.list_user_route(db, int(user_id))
    except ValueError:
        return fail("401", "未授权，请重新登录")
    except Exception:
        return fail("500", "服务未初始化")
    return ok(tree)
