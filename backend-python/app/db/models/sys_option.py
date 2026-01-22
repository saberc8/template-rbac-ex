"""sys_option 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysOption(Base):
    __tablename__ = "sys_option"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text)
    default_value: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(String(200))
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (Index("uk_option_category_code", "category", "code", unique=True),)
