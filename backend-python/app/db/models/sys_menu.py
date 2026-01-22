"""sys_menu 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, Integer, SmallInteger, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysMenu(Base):
    __tablename__ = "sys_menu"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    title: Mapped[str] = mapped_column(String(30), nullable=False)
    parent_id: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))
    type: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    path: Mapped[Optional[str]] = mapped_column(String(255))
    name: Mapped[Optional[str]] = mapped_column(String(50))
    component: Mapped[Optional[str]] = mapped_column(String(255))
    redirect: Mapped[Optional[str]] = mapped_column(String(255))
    icon: Mapped[Optional[str]] = mapped_column(String(50))
    is_external: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text("FALSE"))
    is_cache: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text("FALSE"))
    is_hidden: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text("FALSE"))
    permission: Mapped[Optional[str]] = mapped_column(String(100))
    sort: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("999"))
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    create_user: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_menu_parent_id", "parent_id"),
        Index("idx_menu_create_user", "create_user"),
        Index("idx_menu_update_user", "update_user"),
        Index("uk_menu_title_parent_id", "title", "parent_id", unique=True),
    )
