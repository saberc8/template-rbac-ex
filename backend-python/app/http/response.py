"""统一响应包装（对齐 backend-go/internal/interfaces/http/response.go）。"""

from __future__ import annotations

import time
from typing import Any, TypedDict


class APIResponse(TypedDict):
    code: str
    data: Any
    msg: str
    success: bool
    timestamp: str


def _now_millis_str() -> str:
    return str(int(time.time() * 1000))


def ok(data: Any) -> APIResponse:
    return {
        "code": "200",
        "data": data,
        "msg": "操作成功",
        "success": True,
        "timestamp": _now_millis_str(),
    }


def fail(code: str, msg: str) -> APIResponse:
    return {
        "code": str(code),
        "data": None,
        "msg": msg,
        "success": False,
        "timestamp": _now_millis_str(),
    }


class AppError(Exception):
    def __init__(self, code: str, msg: str):
        super().__init__(msg)
        self.code = str(code)
        self.msg = msg

