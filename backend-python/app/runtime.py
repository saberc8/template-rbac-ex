"""运行时资源容器：Settings / TokenService / Redis 客户端 / OnlineStore。

约定：
- 允许模块导入（如 `from app.runtime import settings`）不触发外部资源初始化；
- 运行时资源按需（lazy）初始化，保持现有对外行为不变；
- 如需测试注入，可通过 `set_runtime()` 覆盖默认实例。
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any, Optional

import redis

from app.config import Settings, load_settings
from app.http.online_store import OnlineStore
from app.security.jwt import TokenService


@dataclass(frozen=True)
class Runtime:
    settings: Settings
    token_service: TokenService
    redis_client: redis.Redis
    online_store: OnlineStore


_RUNTIME_LOCK = threading.Lock()
_RUNTIME: Optional[Runtime] = None


def build_runtime(settings: Optional[Settings] = None) -> Runtime:
    s = settings or load_settings()
    return Runtime(
        settings=s,
        token_service=TokenService(s.auth_jwt_secret, ttl_seconds=24 * 60 * 60),
        redis_client=redis.Redis.from_url(s.redis_url, decode_responses=True),
        online_store=OnlineStore(),
    )


def get_runtime() -> Runtime:
    global _RUNTIME
    if _RUNTIME is not None:
        return _RUNTIME
    with _RUNTIME_LOCK:
        if _RUNTIME is None:
            _RUNTIME = build_runtime()
        return _RUNTIME


def set_runtime(runtime: Runtime) -> None:
    global _RUNTIME
    with _RUNTIME_LOCK:
        _RUNTIME = runtime


class _RuntimeAttrProxy:
    def __init__(self, attr: str):
        self._attr = attr

    def _target(self) -> Any:
        return getattr(get_runtime(), self._attr)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._target(), name)

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        return self._target()(*args, **kwargs)


# 兼容旧用法：保持同名导出（但改为 proxy，以避免 import side-effect）。
settings = _RuntimeAttrProxy("settings")
token_service = _RuntimeAttrProxy("token_service")
redis_client = _RuntimeAttrProxy("redis_client")
online_store = _RuntimeAttrProxy("online_store")
