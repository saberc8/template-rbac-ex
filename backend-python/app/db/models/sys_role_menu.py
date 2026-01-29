"""sys_role_menu 表模型。"""

from __future__ import annotations

from sqlalchemy import BigInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SysRoleMenu(Base):
    __tablename__ = "sys_role_menu"

    role_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    menu_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
