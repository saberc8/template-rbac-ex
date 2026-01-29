"""鉴权上下文中间件：解析 Authorization（Bearer Token）并写入 request.state.user_id。"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.runtime import token_service


class AuthContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        authz = (request.headers.get("Authorization") or "").strip()
        if authz:
            try:
                claims = token_service.parse(authz)
                request.state.user_id = claims.user_id
            except Exception:
                pass
        return await call_next(request)
