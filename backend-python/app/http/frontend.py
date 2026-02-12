"""前端数据集选择工具（vue3/react）。

用于在同一套 /system/* API 下隔离不同前端的 sys_menu 数据集，避免角色权限保存互相覆盖。
"""

from __future__ import annotations

from typing import Optional

from fastapi import Request
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.runtime import settings as runtime_settings


def has_frontend_column(db: Session) -> bool:
    try:
        cols = inspect(db.get_bind()).get_columns("sys_menu")
    except Exception:
        return False
    return any(str(c.get("name") or "") == "frontend" for c in cols)


def frontend_from_request(request: Request | None) -> Optional[str]:
    if request is None:
        return None
    v = (request.headers.get("X-Admin-Frontend") or request.headers.get("X-Frontend") or "").strip().lower()
    return v if v in {"vue3", "react"} else None


def active_frontend(db: Session, request: Request | None = None) -> Optional[str]:
    """返回当前生效的前端类型。

    - 未升级到 sys_menu.frontend 字段：返回 None（表示不做过滤）
    - 已升级：优先按请求头 X-Admin-Frontend 选择；否则按 ADMIN_FRONTEND_TYPE
    """

    if not has_frontend_column(db):
        return None
    by_header = frontend_from_request(request)
    if by_header is not None:
        return by_header
    v = str(runtime_settings.admin_frontend_type or "vue3").strip().lower()
    return v if v in {"vue3", "react"} else "vue3"

