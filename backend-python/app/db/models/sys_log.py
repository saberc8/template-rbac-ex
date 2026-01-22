"""sys_log 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Index, Integer, SmallInteger, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysLog(Base):
    __tablename__ = "sys_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    trace_id: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    module: Mapped[str] = mapped_column(String(100), nullable=False)
    request_url: Mapped[str] = mapped_column(String(512), nullable=False)
    request_method: Mapped[str] = mapped_column(String(10), nullable=False)
    request_headers: Mapped[Optional[str]] = mapped_column(Text)
    request_body: Mapped[Optional[str]] = mapped_column(Text)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    response_headers: Mapped[Optional[str]] = mapped_column(Text)
    response_body: Mapped[Optional[str]] = mapped_column(Text)
    time_taken: Mapped[int] = mapped_column(BigInteger, nullable=False)
    ip: Mapped[Optional[str]] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(String(255))
    browser: Mapped[Optional[str]] = mapped_column(String(100))
    os: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    error_msg: Mapped[Optional[str]] = mapped_column(Text)
    create_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    __table_args__ = (
        Index("idx_log_module", "module"),
        Index("idx_log_ip", "ip"),
        Index("idx_log_address", "address"),
        Index("idx_log_create_time", "create_time"),
    )
