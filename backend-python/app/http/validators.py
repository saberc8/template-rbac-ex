"""HTTP 层通用校验与解析（统一错误返回风格）。"""

from __future__ import annotations

from typing import Any, Optional, TypeVar

from app.http.response import APIResponse, fail

T = TypeVar("T")


def require_dict_body(body: Any) -> tuple[Optional[dict[str, Any]], Optional[APIResponse]]:
    if not isinstance(body, dict):
        return None, fail("400", "请求参数不正确")
    return body, None


def require_non_empty_str(v: Any, msg: str) -> tuple[Optional[str], Optional[APIResponse]]:
    s = str(v or "").strip()
    if s == "":
        return None, fail("400", msg)
    return s, None


def require_list(v: Any, msg: str) -> tuple[Optional[list[Any]], Optional[APIResponse]]:
    if not isinstance(v, list) or len(v) == 0:
        return None, fail("400", msg)
    return v, None


def parse_positive_int_list(v: Any, msg: str) -> tuple[list[int], Optional[APIResponse]]:
    if not isinstance(v, list) or len(v) == 0:
        return [], fail("400", msg)

    ids: list[int] = []
    for item in v:
        try:
            iv = int(item)
        except Exception:
            continue
        if iv > 0:
            ids.append(iv)
    ids = list(dict.fromkeys(ids))
    if not ids:
        return [], fail("400", msg)
    return ids, None


def parse_int(
    v: Any,
    msg: str,
    *,
    default: Optional[int] = None,
    min_value: Optional[int] = None,
    max_value: Optional[int] = None,
) -> tuple[Optional[int], Optional[APIResponse]]:
    if v is None or v == "":
        if default is not None:
            return default, None
        return None, fail("400", msg)

    try:
        n = int(v)
    except Exception:
        return None, fail("400", msg)

    if min_value is not None and n < min_value:
        return None, fail("400", msg)
    if max_value is not None and n > max_value:
        return None, fail("400", msg)
    return n, None
