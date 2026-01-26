"""验证码 Redis key 规范（对齐 Go: CAPTCHA:{uuid}）。"""

from __future__ import annotations

import threading
import time
from typing import Optional

def build_redis_key(uuid: str) -> str:
    return f"CAPTCHA:{uuid}"


_MEM_LOCK = threading.Lock()
_MEM_CODES: dict[str, tuple[str, float]] = {}


def set_code_in_memory(key: str, code: str, ttl_seconds: int) -> None:
    expires_at = time.time() + max(int(ttl_seconds), 1)
    with _MEM_LOCK:
        _MEM_CODES[key] = (code, expires_at)


def get_code_from_memory(key: str) -> Optional[str]:
    now = time.time()
    with _MEM_LOCK:
        item = _MEM_CODES.get(key)
        if not item:
            return None
        code, expires_at = item
        if expires_at <= now:
            _MEM_CODES.pop(key, None)
            return None
        return code


def delete_code_from_memory(key: str) -> None:
    with _MEM_LOCK:
        _MEM_CODES.pop(key, None)
