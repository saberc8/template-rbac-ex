"""sys_role 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, Integer, SmallInteger, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysRole(Base):
    __tablename__ = "sys_role"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    data_scope: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("4"))
    description: Mapped[Optional[str]] = mapped_column(String(200))
    sort: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("999"))
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    menu_check_strictly: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text("TRUE"))
    dept_check_strictly: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text("TRUE"))
    create_user: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("uk_role_name", "name", unique=True),
        Index("uk_role_code", "code", unique=True),
        Index("idx_role_create_user", "create_user"),
        Index("idx_role_update_user", "update_user"),
    )
