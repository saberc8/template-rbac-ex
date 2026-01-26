"""slash-admin(React) 用户相关接口：/user/*。"""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response


router = APIRouter()


@router.post("/user/tokenExpired")
def token_expired():
    # 对齐 slash-admin 的 MSW 行为：直接返回 HTTP 401 触发前端登出逻辑。
    return Response(status_code=401)

