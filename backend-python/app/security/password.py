"""BCrypt 密码校验/生成（兼容 {bcrypt} 前缀）。"""

from __future__ import annotations

import bcrypt


_PREFIX = "{bcrypt}"


def verify_password(raw: str, encoded: str) -> bool:
    if encoded is None or encoded == "":
        return False
    if encoded.startswith(_PREFIX):
        encoded = encoded[len(_PREFIX) :]
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), encoded.encode("utf-8"))
    except Exception:
        return False


def hash_password(raw: str) -> str:
    raw = (raw or "").strip()
    if raw == "":
        raise ValueError("empty password")
    hashed = bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt())
    return _PREFIX + hashed.decode("utf-8")

