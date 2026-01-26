"""配置加载与默认值处理（对齐 backend-go 的环境变量约定）。"""

from __future__ import annotations

from dataclasses import dataclass
import os
import pathlib
from typing import Optional

from dotenv import load_dotenv


def _parse_bool(value: Optional[str]) -> tuple[bool, bool]:
    if value is None:
        return False, False
    v = value.strip().lower()
    if v in {"1", "true", "yes", "y", "on"}:
        return True, True
    if v in {"0", "false", "no", "n", "off"}:
        return False, True
    try:
        n = int(v)
        return n != 0, True
    except Exception:
        return False, False


def _getenv_default(key: str, default: str) -> str:
    v = os.getenv(key)
    if v is None or v == "":
        return default
    return v


def _load_dotenv_for_dev() -> None:
    env = (os.getenv("APP_ENV") or "").strip().lower()
    if env in {"prod", "production"}:
        return
    load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_env: str
    http_port: str
    admin_frontend_type: str
    file_storage_dir: str
    auto_migrate: bool

    auth_jwt_secret: str

    db_dialect: str
    db_host: str
    db_port: int
    db_user: str
    db_pwd: str
    db_name: str
    db_sslmode: str

    redis_host: str
    redis_port: int
    redis_pwd: str
    redis_db: int

    @property
    def database_url(self) -> str:
        dialect = (self.db_dialect or "postgres").strip().lower()
        if dialect in {"postgres", "postgresql", "pgsql"}:
            return (
                f"postgresql+psycopg2://{self.db_user}:{self.db_pwd}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}"
                f"?sslmode={self.db_sslmode}"
            )
        if dialect in {"mysql"}:
            return (
                f"mysql+pymysql://{self.db_user}:{self.db_pwd}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}"
                f"?charset=utf8mb4"
            )
        raise ValueError(f"unsupported DB_DIALECT: {self.db_dialect}")

    @property
    def redis_url(self) -> str:
        pwd = self.redis_pwd or ""
        auth = f":{pwd}@" if pwd else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def file_storage_dir_abs(self) -> str:
        return str(pathlib.Path(self.file_storage_dir).resolve())


def load_settings() -> Settings:
    _load_dotenv_for_dev()

    app_env = (os.getenv("APP_ENV") or "").strip().lower() or "dev"
    http_port = _getenv_default("HTTP_PORT", "14396").strip() or "14396"
    admin_frontend_type = (_getenv_default("ADMIN_FRONTEND_TYPE", "vue3") or "vue3").strip().lower()
    if admin_frontend_type not in {"vue3", "react"}:
        raise RuntimeError("invalid ADMIN_FRONTEND_TYPE: must be 'vue3' or 'react'")
    file_storage_dir = _getenv_default("FILE_STORAGE_DIR", "./data/file").strip() or "./data/file"

    auth_jwt_secret = (os.getenv("AUTH_JWT_SECRET") or "").strip()
    if auth_jwt_secret == "":
        raise RuntimeError("missing required env var: AUTH_JWT_SECRET")

    auto_migrate_raw = os.getenv("DB_AUTO_MIGRATE")
    auto_migrate, ok = _parse_bool(auto_migrate_raw)
    if not ok:
        auto_migrate = app_env not in {"prod", "production"}

    db_dialect = _getenv_default("DB_DIALECT", "postgres").strip() or "postgres"
    db_host = _getenv_default("DB_HOST", "127.0.0.1").strip() or "127.0.0.1"
    db_port = int(_getenv_default("DB_PORT", "5432"))
    db_user = _getenv_default("DB_USER", "postgres").strip() or "postgres"
    db_pwd = _getenv_default("DB_PWD", "123456")
    db_name = _getenv_default("DB_NAME", "ex_admin_v1")
    db_sslmode = _getenv_default("DB_SSLMODE", "disable")

    redis_host = _getenv_default("REDIS_HOST", "127.0.0.1").strip() or "127.0.0.1"
    redis_port = int(_getenv_default("REDIS_PORT", "6379"))
    redis_pwd = _getenv_default("REDIS_PWD", "")
    redis_db = int(_getenv_default("REDIS_DB", "0"))

    return Settings(
        app_env=app_env,
        http_port=http_port,
        admin_frontend_type=admin_frontend_type,
        file_storage_dir=file_storage_dir,
        auto_migrate=auto_migrate,
        auth_jwt_secret=auth_jwt_secret,
        db_dialect=db_dialect,
        db_host=db_host,
        db_port=db_port,
        db_user=db_user,
        db_pwd=db_pwd,
        db_name=db_name,
        db_sslmode=db_sslmode,
        redis_host=redis_host,
        redis_port=redis_port,
        redis_pwd=redis_pwd,
        redis_db=redis_db,
    )
