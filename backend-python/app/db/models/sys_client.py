"""sys_client 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import BigInteger, DateTime, Index, JSON, SmallInteger, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysClient(Base):
    __tablename__ = "sys_client"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    client_id: Mapped[str] = mapped_column(String(50), nullable=False)
    client_type: Mapped[str] = mapped_column(String(50), nullable=False)
    auth_type: Mapped[Any] = mapped_column(JSON, nullable=False)
    active_timeout: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("-1"))
    timeout: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("2592000"))
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    create_user: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("uk_client_client_id", "client_id", unique=True),
        Index("idx_client_create_user", "create_user"),
        Index("idx_client_update_user", "update_user"),
    )
