"""数据库初始化数据（seed）。

目标：
- Python 后端不再在运行时读取 backend-go 源码，避免“两个后端交叉依赖”。
- Vue3 兼容接口（/system/*、/auth/user/route 等）继续使用既有 sys_menu 数据形态。
- React（slash-admin）动态路由（/menu）使用同一张 sys_menu 表的独立数据集（frontend='react'），与 Vue3 逻辑隔离。

说明：
- 基础 seed SQL 以快照形式内置在 `app/db/seed_data.py`。
- React 菜单 seed 数据以快照形式内置在 `app/db/seed_react_menu_data.py`。
- 为兼容老库（未增加 frontend 字段），React 菜单 seed 会在检测到字段存在后才执行。
"""

from __future__ import annotations

import hashlib
from typing import Union

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, Engine

from app.db.seed_data import SEED_SQL_BLOCKS
from app.db.seed_react_menu_data import REACT_MENU_FLAT


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


def _has_column(conn: Connection, table: str, column: str) -> bool:
    try:
        cols = inspect(conn).get_columns(table)
    except Exception:
        return False
    return any(str(c.get("name") or "") == column for c in cols)


def _stable_i64_from_string(value: str) -> int:
    """把任意字符串映射到稳定的 BIGINT（正数），用于 React 菜单 id。"""

    if value == "":
        return 0
    digest = hashlib.sha1(value.encode("utf-8")).digest()[:8]  # nosec B324
    num = int.from_bytes(digest, byteorder="big", signed=False) & 0x7FFFFFFFFFFFFFFF
    return num if num != 0 else 1


def _seed_base(conn: Connection) -> None:
    dialect = conn.dialect.name.lower()
    blocks = list(SEED_SQL_BLOCKS)

    # MySQL 不支持 ::json 类型转换，直接移除 cast，JSON 字面量本身可直接写入 JSON 列。
    if dialect.startswith("mysql"):
        blocks = [b.replace("::json", "") for b in blocks]

    for block in blocks:
        for stmt in _split_sql(block):
            conn.execute(text(stmt))

    # PostgreSQL：补充 JSON GIN 索引（MySQL 跳过）
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


def _seed_react_menu(conn: Connection) -> None:
    # 仅当 schema 已具备 frontend 字段时才启用该 seed（避免老库/未迁移时报错）。
    if not _has_column(conn, "sys_menu", "frontend"):
        return

    id_map: dict[str, int] = {}
    for item in REACT_MENU_FLAT:
        sid = str(item.get("id") or "").strip()
        if sid == "":
            continue
        id_map[sid] = _stable_i64_from_string(sid)

    def _pid(s: str) -> int:
        s = str(s or "").strip()
        if s == "":
            return 0
        return id_map.get(s) or _stable_i64_from_string(s)

    for idx, item in enumerate(REACT_MENU_FLAT, start=1):
        sid = str(item.get("id") or "").strip()
        if sid == "":
            continue

        mid = id_map[sid]
        pid = _pid(item.get("parentId") or "")
        title = str(item.get("name") or "").strip() or sid
        code = str(item.get("code") or "").strip() or sid
        typ = int(item.get("type") or 2)

        path = str(item.get("path") or "").strip() or None
        component = str(item.get("component") or "").strip() or None

        icon = item.get("icon")
        icon = (str(icon).strip() if icon is not None else None) or None

        # React 菜单的“权限码”：只给 MENU(2) 写入，避免目录/分组被误判为权限点
        perm = code if typ == 2 else None

        conn.execute(
            text(
                """
INSERT INTO sys_menu
    (id, title, parent_id, type, path, name, component, redirect, icon,
     is_external, is_cache, is_hidden, permission, sort, status,
     create_user, create_time, frontend)
SELECT
    :id, :title, :parent_id, :type, :path, :name, :component, NULL, :icon,
    FALSE, FALSE, FALSE, :permission, :sort, 1,
    1, NOW(), 'react'
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE id = :id);
"""
            ),
            {
                "id": mid,
                "title": title,
                "parent_id": pid,
                "type": typ,
                "path": path,
                "name": code[:50],
                "component": component,
                "icon": icon,
                "permission": perm,
                "sort": idx,
            },
        )

        # role-menu：默认给 admin(1) 绑定所有 react 菜单
        conn.execute(
            text(
                """
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, :menu_id
WHERE NOT EXISTS (SELECT 1 FROM sys_role_menu WHERE role_id = 1 AND menu_id = :menu_id);
"""
            ),
            {"menu_id": mid},
        )


def seed_from_go_migrate(bind: Union[Engine, Connection]) -> None:
    """兼容历史迁移脚本的入口；实现已切换为 Python 内置 seed。"""

    def _apply(conn: Connection) -> None:
        _seed_base(conn)
        _seed_react_menu(conn)

    if isinstance(bind, Engine):
        with bind.begin() as conn:
            _apply(conn)
        return

    _apply(bind)
