"""sys_user 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, SmallInteger, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysUser(Base):
    __tablename__ = "sys_user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    nickname: Mapped[str] = mapped_column(String(30), nullable=False)
    password: Mapped[Optional[str]] = mapped_column(String(255))
    gender: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("0"))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(255))
    avatar: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(String(200))
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    pwd_reset_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    dept_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("uk_user_username", "username", unique=True),
        Index("uk_user_email", "email", unique=True),
        Index("uk_user_phone", "phone", unique=True),
        Index("idx_user_dept_id", "dept_id"),
        Index("idx_user_create_user", "create_user"),
        Index("idx_user_update_user", "update_user"),
    )
