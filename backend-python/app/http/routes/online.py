"""在线用户接口：/monitor/online（对齐 backend-go/internal/interfaces/http/online_handler.go）。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.http.deps import require_user_id
from app.http.response import fail, ok
from app.http.utils import get_query_list, parse_time_ymdhms
from app.http.validators import parse_page_size
from app.runtime import online_store

router = APIRouter()


@router.get("/monitor/online")
def page_online_user(request: Request):
    page, size = parse_page_size(
        request.query_params.get("page"),
        request.query_params.get("size"),
        default_page=1,
        default_size=10,
        min_page=1,
        min_size=1,
    )

    nickname = (request.query_params.get("nickname") or "").strip()
    time_range = get_query_list(request, "loginTime")
    start_time = parse_time_ymdhms(time_range[0]) if len(time_range) == 2 else None
    end_time = parse_time_ymdhms(time_range[1]) if len(time_range) == 2 else None

    items, total = online_store.list(
        nickname=nickname, login_start=start_time, login_end=end_time, page=page, size=size
    )
    return ok({"list": items, "total": int(total)})


@router.delete("/monitor/online/{token}")
def kickout(token: str, request: Request, _user_id: int = Depends(require_user_id)):
    token = (token or "").strip()
    if token == "":
        return fail("400", "令牌不能为空")

    authz = (request.headers.get("Authorization") or "").strip()
    current = authz
    if current.lower().startswith("bearer "):
        current = current[7:].strip()
    if current and current == token:
        return fail("400", "不能强退自己")

    online_store.remove_by_token(token)
    return ok(True)
