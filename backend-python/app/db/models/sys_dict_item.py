"""sys_dict_item 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Index, Integer, SmallInteger, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysDictItem(Base):
    __tablename__ = "sys_dict_item"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    label: Mapped[str] = mapped_column(String(30), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(30))
    sort: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("999"))
    description: Mapped[Optional[str]] = mapped_column(String(200))
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    dict_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_user: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_dict_item_dict_id", "dict_id"),
        Index("idx_dict_item_create_user", "create_user"),
        Index("idx_dict_item_update_user", "update_user"),
    )
