"""JWT 生成与解析（对齐 backend-go/internal/infrastructure/security/jwt.go）。"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import re
from typing import Any

import jwt


_bearer_re = re.compile(r"^bearer\s+", re.IGNORECASE)


@dataclass(frozen=True)
class Claims:
    user_id: int


class TokenService:
    def __init__(self, secret: str, ttl_seconds: int = 24 * 60 * 60):
        self._secret = (secret or "").encode("utf-8")
        self._ttl_seconds = ttl_seconds if ttl_seconds > 0 else 24 * 60 * 60

    def generate(self, user_id: int) -> str:
        now = datetime.now(tz=timezone.utc)
        payload: dict[str, Any] = {
            "userId": int(user_id),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=self._ttl_seconds)).timestamp()),
        }
        return jwt.encode(payload, self._secret, algorithm="HS256")

    def parse(self, token_or_header: str) -> Claims:
        token = (token_or_header or "").strip()
        if token == "":
            raise ValueError("empty token")
        token = _bearer_re.sub("", token).strip()
        payload = jwt.decode(token, self._secret, algorithms=["HS256"])
        uid = int(payload.get("userId") or 0)
        if uid <= 0:
            raise ValueError("invalid token")
        return Claims(user_id=uid)

