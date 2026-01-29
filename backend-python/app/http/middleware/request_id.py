"""request-id 中间件：写入 X-Request-Id，并存入 request.state（对齐 Go）。"""

from __future__ import annotations

import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

HEADER_NAME = "X-Request-Id"


def _new_request_id() -> str:
    return secrets.token_hex(16)


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = (request.headers.get(HEADER_NAME) or "").strip()
        if rid == "":
            rid = (request.headers.get("X-Request-ID") or "").strip()
        if rid == "":
            rid = _new_request_id()

        request.state.request_id = rid
        resp: Response = await call_next(request)
        resp.headers[HEADER_NAME] = rid
        return resp


def get_request_id(request: Request) -> str:
    rid = getattr(request.state, "request_id", "")
    return (rid or "").strip()
