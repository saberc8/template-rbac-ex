"""FastAPI 依赖：DB Session、鉴权用户等。"""

from __future__ import annotations

from typing import Generator
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.http.response import AppError
from app.db.runtime import SessionLocal


def get_db() -> Generator[Session, None, None]:
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_user_id(request: Request) -> Optional[int]:
    uid = getattr(request.state, "user_id", None)
    if uid is None:
        return None
    try:
        uid = int(uid)
    except Exception:
        return None
    return uid if uid > 0 else None


def require_user_id(request: Request) -> int:
    uid = get_user_id(request)
    if uid is None:
        raise AppError("401", "未授权，请重新登录")
    return uid
