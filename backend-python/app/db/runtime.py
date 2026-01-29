"""运行时数据库资源（Engine/SessionLocal）。"""

from __future__ import annotations

from app.config import load_settings
from app.db.engine import create_db_engine, create_session_factory

_settings = load_settings()
engine = create_db_engine(_settings)
SessionLocal = create_session_factory(engine)
