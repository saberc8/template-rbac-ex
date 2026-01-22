"""sys_role_dept 表模型。"""

from __future__ import annotations

from sqlalchemy import BigInteger, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysRoleDept(Base):
    __tablename__ = "sys_role_dept"

    role_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    dept_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    __table_args__ = (
        Index("idx_role_dept_role_id", "role_id"),
        Index("idx_role_dept_dept_id", "dept_id"),
    )

