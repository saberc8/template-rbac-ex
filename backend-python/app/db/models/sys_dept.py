"""sys_dept 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, Integer, SmallInteger, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysDept(Base):
    __tablename__ = "sys_dept"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    parent_id: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))
    sort: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("999"))
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    description: Mapped[Optional[str]] = mapped_column(String(200))
    create_user: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_dept_parent_id", "parent_id"),
        Index("idx_dept_create_user", "create_user"),
        Index("idx_dept_update_user", "update_user"),
    )
