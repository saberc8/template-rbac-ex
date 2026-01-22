"""sys_storage 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, Integer, SmallInteger, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysStorage(Base):
    __tablename__ = "sys_storage"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    type: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    access_key: Mapped[Optional[str]] = mapped_column(String(255))
    secret_key: Mapped[Optional[str]] = mapped_column(String(255))
    endpoint: Mapped[Optional[str]] = mapped_column(String(255))
    region: Mapped[Optional[str]] = mapped_column(String(100))
    bucket_name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(String(200))
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    sort: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("999"))
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    create_user: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("uk_storage_code", "code", unique=True),
        Index("idx_storage_create_user", "create_user"),
        Index("idx_storage_update_user", "update_user"),
    )
