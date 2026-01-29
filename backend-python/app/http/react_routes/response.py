"""slash-admin(React) 前端使用的统一响应包装。"""

from __future__ import annotations

from typing import Any, TypedDict


class ReactAPIResponse(TypedDict):
    status: int
    message: str
    data: Any


class ResultStatus:
    SUCCESS = 0
    ERROR = -1
    TIMEOUT = 401


def ok(data: Any, message: str = "") -> ReactAPIResponse:
    return {"status": ResultStatus.SUCCESS, "message": message or "", "data": data}


def fail(message: str, status: int = ResultStatus.ERROR, data: Any = None) -> ReactAPIResponse:
    return {"status": int(status), "message": message or "", "data": data}
