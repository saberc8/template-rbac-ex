"""sys_file 表模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Index, SmallInteger, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysFile(Base):
    __tablename__ = "sys_file"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[Optional[int]] = mapped_column(BigInteger)
    parent_path: Mapped[str] = mapped_column(String(512), nullable=False, server_default=text("'/'"))
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    extension: Mapped[Optional[str]] = mapped_column(String(100))
    content_type: Mapped[Optional[str]] = mapped_column(String(255))
    type: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default=text("1"))
    sha256: Mapped[str] = mapped_column(String(256), nullable=False)
    metadata_: Mapped[Optional[str]] = mapped_column("metadata", Text)
    thumbnail_name: Mapped[Optional[str]] = mapped_column(String(255))
    thumbnail_size: Mapped[Optional[int]] = mapped_column(BigInteger)
    thumbnail_metadata: Mapped[Optional[str]] = mapped_column(Text)
    storage_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_user: Mapped[int] = mapped_column(BigInteger, nullable=False)
    create_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    update_user: Mapped[Optional[int]] = mapped_column(BigInteger)
    update_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_file_type", "type"),
        Index("idx_file_sha256", "sha256"),
        Index("idx_file_storage_id", "storage_id"),
        Index("idx_file_create_user", "create_user"),
    )
