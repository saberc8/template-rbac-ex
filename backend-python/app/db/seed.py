"""数据库初始化数据（seed）。

当前实现以 `backend-go/internal/infrastructure/db/migrate.go` 为 SSOT，提取其中的 seed SQL，
保证 Python 与 Go 的默认数据一致（菜单/角色/用户/配置等）。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional, Union

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine


_ROOT = Path(__file__).resolve().parents[3]
_GO_MIGRATE_PATH = _ROOT / "backend-go" / "internal" / "infrastructure" / "db" / "migrate.go"


def _split_sql(sql: str) -> list[str]:
    sql = sql.strip()
    if not sql:
        return []
    out: list[str] = []
    buf: list[str] = []
    in_quote = False
    i = 0
    while i < len(sql):
        ch = sql[i]
        if ch == "'" and (i == 0 or sql[i - 1] != "\\"):
            in_quote = not in_quote
            buf.append(ch)
            i += 1
            continue
        if ch == ";" and not in_quote:
            stmt = "".join(buf).strip()
            buf = []
            if stmt:
                out.append(stmt)
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        out.append(tail)
    return out


def _extract_block(text_all: str, func_name: Optional[str], const_name: str) -> str:
    hay = text_all
    if func_name:
        start = hay.find(f"func {func_name}(")
        if start < 0:
            raise RuntimeError(f"cannot find function {func_name} in migrate.go")
        next_func = hay.find("\nfunc ", start + 10)
        if next_func < 0:
            next_func = len(hay)
        hay = hay[start:next_func]

    m = re.search(rf"const\\s+{re.escape(const_name)}\\s*=\\s*`([\\s\\S]*?)`", hay)
    if not m:
        raise RuntimeError(f"cannot find const {const_name} in migrate.go (func={func_name})")
    return m.group(1)


def seed_from_go_migrate(bind: Union[Engine, Connection]) -> None:
    if not _GO_MIGRATE_PATH.exists():
        raise RuntimeError(f"missing go migrate source: {_GO_MIGRATE_PATH}")

    go_text = _GO_MIGRATE_PATH.read_text(encoding="utf-8")
    dialect = bind.dialect.name.lower()

    blocks: list[str] = []
    blocks.append(_extract_block(go_text, "ensureSysUser", "seedAdmin"))
    blocks.append(_extract_block(go_text, "ensureSysRole", "seedRoles"))
    blocks.append(_extract_block(go_text, "ensureSysUserRole", "seed"))
    blocks.append(_extract_block(go_text, "ensureSysMenu", "seedMenus"))
    blocks.append(_extract_block(go_text, "ensureSysRoleMenu", "bindAllMenus"))
    blocks.append(_extract_block(go_text, "ensureSysDept", "seed"))
    blocks.append(_extract_block(go_text, "ensureSysDict", "seed"))
    blocks.append(_extract_block(go_text, "ensureSysDictItem", "seedItems"))
    blocks.append(_extract_block(go_text, "ensureSysOption", "seed"))
    blocks.append(_extract_block(go_text, "ensureSysStorage", "seed"))
    blocks.append(_extract_block(go_text, "ensureSysClient", "seed"))

    # MySQL 不支持 ::json 类型转换，直接移除 cast，JSON 字面量本身可直接写入 JSON 列。
    if dialect.startswith("mysql"):
        blocks = [b.replace("::json", "") for b in blocks]

    def _apply(conn: Connection) -> None:
        for block in blocks:
            for stmt in _split_sql(block):
                conn.execute(text(stmt))

        # PostgreSQL：补充与 Go 端一致的 JSON GIN 索引（MySQL 跳过）
        if dialect.startswith("postgres"):
            conn.execute(
                text(
                    """
CREATE INDEX IF NOT EXISTS idx_client_auth_type_gin
    ON sys_client
    USING GIN ((auth_type::jsonb));
"""
                )
            )

    if isinstance(bind, Engine):
        with bind.begin() as conn:
            _apply(conn)
        return

    _apply(bind)
