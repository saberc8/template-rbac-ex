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


def parse_positive_int_list_allow_empty(v: Any) -> list[int]:
    """宽松解析正整数列表：失败/空值则返回空列表（适用于可选数组字段）。"""

    if not isinstance(v, list) or len(v) == 0:
        return []

    ids: list[int] = []
    for item in v:
        try:
            iv = int(item)
        except Exception:
            continue
        if iv > 0:
            ids.append(iv)
    return list(dict.fromkeys(ids))


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


def parse_int_or_default(v: Any, default: int) -> int:
    """宽松解析 int：失败/空值则回退 default（适用于 query 参数）。"""

    if v is None or v == "":
        return int(default)
    try:
        return int(v)
    except Exception:
        return int(default)


def parse_page_size(
    page_v: Any,
    size_v: Any,
    *,
    default_page: int = 1,
    default_size: int = 10,
    min_page: int = 1,
    min_size: int = 1,
    max_size: Optional[int] = None,
) -> tuple[int, int]:
    """解析分页参数，按既有接口习惯兜底为默认值。

    - 解析失败/空值：回退 default
    - 小于最小值：回退到最小值
    - 允许 max_size 限制（如无则不限制）
    """

    try:
        page = int(page_v or default_page)
    except Exception:
        page = int(default_page)
    try:
        size = int(size_v or default_size)
    except Exception:
        size = int(default_size)

    # 与既有接口行为对齐：当参数不合法（如 <=0）时回退默认值，而不是夹逼到最小值。
    if page < int(min_page):
        page = int(default_page)
    if size < int(min_size):
        size = int(default_size)
    if max_size is not None and size > int(max_size):
        size = int(max_size)
    return page, size
