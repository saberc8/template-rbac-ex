"""显式执行数据库初始化/迁移（对齐 backend-go/cmd/migrate）。"""

from __future__ import annotations

import os
from pathlib import Path
import sys
from typing import Optional

from app.db.base import Base
from app.db.runtime import engine
from app.db import models  # noqa: F401
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
                from alembic import command
                from alembic.config import Config

                cfg = Config(str(ini))
                cfg.set_main_option("script_location", str(root / "alembic"))
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
