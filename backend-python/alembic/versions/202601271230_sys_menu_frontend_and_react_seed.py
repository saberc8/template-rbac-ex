"""sys_menu 增加 frontend 字段 + React 菜单 seed。

Revision ID: 202601271230
Revises: 202601212401
Create Date: 2026-01-27 12:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from app.db.seed import seed_from_go_migrate


revision = "202601271230"
down_revision = "202601212401"
branch_labels = None
depends_on = None


def _column_exists(bind, table: str, column: str) -> bool:
    try:
        cols = sa.inspect(bind).get_columns(table)
    except Exception:
        return False
    return any(str(c.get("name") or "") == column for c in cols)


def _index_exists(bind, table: str, index_name: str) -> bool:
    try:
        idxs = sa.inspect(bind).get_indexes(table)
    except Exception:
        return False
    return any(str(i.get("name") or "") == index_name for i in idxs)


def upgrade() -> None:
    bind = op.get_bind()

    # 幂等：部分环境可能已提前手工加过该列（或重跑迁移），避免 Duplicate column 错误。
    if not _column_exists(bind, "sys_menu", "frontend"):
        op.add_column("sys_menu", sa.Column("frontend", sa.String(length=20), nullable=False, server_default=sa.text("'vue3'")))

    if not _index_exists(bind, "sys_menu", "idx_menu_frontend"):
        op.create_index("idx_menu_frontend", "sys_menu", ["frontend"])

    # 回填历史数据（默认均归为 vue3 菜单集）
    op.execute("UPDATE sys_menu SET frontend = 'vue3' WHERE frontend IS NULL OR frontend = ''")

    # 在 frontend 字段就绪后补齐 React 菜单（seed 内部会做幂等判断）
    seed_from_go_migrate(bind)


def downgrade() -> None:
    bind = op.get_bind()
    if _index_exists(bind, "sys_menu", "idx_menu_frontend"):
        op.drop_index("idx_menu_frontend", table_name="sys_menu")
    if _column_exists(bind, "sys_menu", "frontend"):
        op.drop_column("sys_menu", "frontend")
