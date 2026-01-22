"""SQLAlchemy Declarative Base 与通用约定。"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass

