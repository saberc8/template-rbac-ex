"""验证码 Redis key 规范（对齐 Go: CAPTCHA:{uuid}）。"""

from __future__ import annotations


def build_redis_key(uuid: str) -> str:
    return f"CAPTCHA:{uuid}"

