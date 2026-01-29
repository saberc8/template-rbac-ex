"""显式执行数据库初始化/迁移（对齐 backend-go/cmd/migrate）。"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional

from sqlalchemy import inspect, text

from app.db import models  # noqa: F401
from app.db.base import Base
from app.db.runtime import engine
from app.db.seed import seed_from_go_migrate


def _parse_bool(value: Optional[str]) -> tuple[bool, bool]:
    if value is None:
        return False, False
    v = value.strip().lower()
    if v in {"1", "true", "yes", "y", "on"}:
        return True, True
    if v in {"0", "false", "no", "n", "off"}:
        return False, True
    return False, False


def main() -> int:
    try:
        use_alembic, ok = _parse_bool(os.getenv("DB_USE_ALEMBIC"))
        if not ok:
            use_alembic = True

        if use_alembic:
            root = Path(__file__).resolve().parents[2]
            ini = root / "alembic.ini"
            if ini.exists():
                from alembic.config import Config

                from alembic import command

                cfg = Config(str(ini))
                cfg.set_main_option("script_location", str(root / "alembic"))

                # 兼容“库已初始化但未写入 alembic_version”的场景：
                # - 例如曾用 Base.metadata.create_all 或其他方式建表
                # - MySQL 下 init_schema 迁移使用 op.create_table，重复执行会报 Table already exists
                inspector = inspect(engine)
                has_version = inspector.has_table("alembic_version")
                has_sys_user = inspector.has_table("sys_user")
                has_sys_menu = inspector.has_table("sys_menu")
                current_version: Optional[str] = None
                if has_version:
                    try:
                        with engine.connect() as conn:
                            row = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).first()
                            if row and row[0] is not None and str(row[0]).strip() != "":
                                current_version = str(row[0]).strip()
                    except Exception:
                        current_version = None

                known_versions = {"202601212401", "202601271230"}
                has_any_core = has_sys_user or has_sys_menu
                if has_any_core:
                    sys.stderr.write(
                        "db-migrate: detected existing tables; "
                        f"sys_user={has_sys_user} sys_menu={has_sys_menu} "
                        f"alembic_version_table={has_version} current_version={current_version or 'NONE'}\n"
                    )
                if has_any_core and (
                    not has_version or current_version is None or current_version not in known_versions
                ):
                    # 假设当前库结构已与 init_schema 对齐（至少已存在核心表），先 stamp 到该 revision，
                    # 再继续 upgrade head，避免 init_schema 重复建表失败。
                    # 同时用 ORM create_all 补齐“被手工删表/部分缺失”的表结构，降低迁移失败概率。
                    sys.stderr.write("db-migrate: stamping alembic revision to 202601212401\n")
                    Base.metadata.create_all(bind=engine)
                    seed_from_go_migrate(engine)
                    command.stamp(cfg, "202601212401")

                command.upgrade(cfg, "head")
            else:
                Base.metadata.create_all(bind=engine)
                seed_from_go_migrate(engine)
        else:
            Base.metadata.create_all(bind=engine)
            seed_from_go_migrate(engine)
    except Exception as exc:
        sys.stderr.write(f"auto-migrate failed: {exc}\n")
        return 1
    sys.stdout.write("auto-migrate done\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
