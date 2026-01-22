"""FastAPI 入口：路由注册与中间件装配。"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

from app.config import load_settings
from app.db.base import Base
from app.db.runtime import engine
from app.db import models  # noqa: F401
from app.db.seed import seed_from_go_migrate
from app.http.middleware.auth_context import AuthContextMiddleware
from app.http.middleware.request_id import RequestIDMiddleware
from app.http.middleware.syslog import SysLogMiddleware
from app.http.response import AppError, fail
from app.http.routes import (
    auth,
    auth_user,
    captcha,
    client,
    common,
    dept,
    dict_api,
    file_api,
    log_api,
    menu,
    online,
    option,
    role,
    storage,
    system_user,
)


def create_app() -> FastAPI:
    settings = load_settings()

    app = FastAPI(title="backend-python", docs_url="/docs", openapi_url="/openapi.json")

    # request-id（写入响应头 + request.state），供日志链路追踪使用
    app.add_middleware(RequestIDMiddleware)

    # CORS：开发阶段允许本地前端调试（与 Go 端策略保持一致，默认放开常用端口）。
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:14397",
            "http://localhost:14399",
            "http://localhost:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 全局鉴权上下文：如携带 token 且合法，则写入 userId 到 request.state。
    app.add_middleware(AuthContextMiddleware)

    # 系统操作日志中间件：采集 sys_log（best-effort）。
    app.add_middleware(SysLogMiddleware)

    @app.exception_handler(AppError)
    async def _app_error_handler(_req, exc: AppError):
        return JSONResponse(status_code=200, content=fail(exc.code, exc.msg))

    @app.exception_handler(RequestValidationError)
    async def _validation_error_handler(_req, _exc: RequestValidationError):
        return JSONResponse(status_code=200, content=fail("400", "请求参数不正确"))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error_handler(_req, exc: StarletteHTTPException):
        # 对齐 Go：统一返回 200，业务码放在 code 字段
        return JSONResponse(status_code=200, content=fail(str(exc.status_code), "系统异常"))

    @app.exception_handler(Exception)
    async def _unhandled_error_handler(_req, _exc: Exception):
        return JSONResponse(status_code=200, content=fail("500", "系统异常"))

    # 静态文件：对齐 Go 的 r.Static("/file", FILE_STORAGE_DIR)
    file_root = os.getenv("FILE_STORAGE_DIR") or settings.file_storage_dir
    app.mount("/file", StaticFiles(directory=file_root), name="file")

    # 路由注册（路径与 Go 保持一致）
    app.include_router(common.router)
    app.include_router(captcha.router)
    app.include_router(auth.router)
    app.include_router(auth_user.router)
    app.include_router(online.router)
    app.include_router(menu.router)
    app.include_router(role.router)
    app.include_router(dept.router)
    app.include_router(system_user.router)
    app.include_router(dict_api.router)
    app.include_router(option.router)
    app.include_router(file_api.router)
    app.include_router(storage.router)
    app.include_router(client.router)
    app.include_router(log_api.router)

    @app.on_event("startup")
    def _startup_auto_migrate() -> None:
        if not settings.auto_migrate:
            return
        Base.metadata.create_all(bind=engine)
        seed_from_go_migrate(engine)

    return app


app = create_app()
