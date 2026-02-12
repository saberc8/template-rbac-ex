"""鉴权上下文中间件：解析 Authorization（Bearer Token）并写入 request.state.user_id。"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.http.response import AppError
from app.runtime import token_service


class AuthContextMiddleware(BaseHTTPMiddleware):
    def _is_public(self, request: Request) -> bool:
        path = request.url.path or "/"

        # CORS 预检请求不做鉴权拦截
        if request.method.upper() == "OPTIONS":
            return True

        # OpenAPI / 文档 / 静态资源
        if path in {"/openapi.json", "/docs", "/redoc"}:
            return True
        if path.startswith("/docs/") or path.startswith("/redoc/"):
            return True
        if path.startswith("/file/"):
            return True

        # 约定开放接口：common + 登录/验证码 + 迁移期 React 兼容端点
        if path.startswith("/common/"):
            return True
        if path.startswith("/captcha/"):
            return True
        if path in {"/auth/login", "/auth/logout"}:
            return True

        # slash-admin(React) 兼容接口：保持其自身的响应协议（由 route 内部决定返回结构）
        if path in {"/menu", "/user/tokenExpired"}:
            return True

        # 兼容可能存在的注册/刷新端点（当前实现可能未启用）
        if path in {"/auth/signup", "/auth/register", "/auth/refresh"}:
            return True

        return False

    async def dispatch(self, request: Request, call_next):
        authz = (request.headers.get("Authorization") or "").strip()
        if authz:
            try:
                claims = token_service.parse(authz)
                request.state.user_id = claims.user_id
            except Exception:
                pass

        # 全局兜底：除开放接口外均要求登录
        if not self._is_public(request):
            uid = getattr(request.state, "user_id", None)
            if uid is None:
                raise AppError("401", "未授权，请重新登录")

        return await call_next(request)
