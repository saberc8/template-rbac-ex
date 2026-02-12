"""密码策略（统一校验与错误提示文案）。"""

from __future__ import annotations

from typing import Optional

from app.http.response import APIResponse, fail


def validate_password(raw_pwd: str) -> tuple[Optional[str], Optional[APIResponse]]:
    raw_pwd = (raw_pwd or "").strip()
    if raw_pwd == "":
        return None, fail("400", "密码不能为空")
    if len(raw_pwd) < 8 or len(raw_pwd) > 32:
        return None, fail("400", "密码长度为 8-32 个字符，至少包含字母和数字")
    has_letter = any(("a" <= ch <= "z") or ("A" <= ch <= "Z") for ch in raw_pwd)
    has_digit = any("0" <= ch <= "9" for ch in raw_pwd)
    if not has_letter or not has_digit:
        return None, fail("400", "密码长度为 8-32 个字符，至少包含字母和数字")
    return raw_pwd, None
