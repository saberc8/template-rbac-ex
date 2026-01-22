"""sys_dict 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysDict(Base):
    __tablename__ = "sys_dict"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(200))
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("FALSE"))
    create_user: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("uk_dict_code", "code", unique=True),
        Index("idx_dict_create_user", "create_user"),
        Index("idx_dict_update_user", "update_user"),
    )
