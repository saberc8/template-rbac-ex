"""验证码接口：GET /captcha/image。"""

from __future__ import annotations

import base64
import os
import random
import time
from io import BytesIO

from fastapi import APIRouter, Depends
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.captcha import build_redis_key
from app.db.models.sys_option import SysOption
from app.http.deps import get_db
from app.http.response import fail, ok
from app.runtime import redis_client


router = APIRouter()


def _getenv_int(key: str, default: int) -> int:
    raw = (os.getenv(key) or "").strip()
    if raw == "":
        return default
    try:
        v = int(raw)
        return v if v > 0 else default
    except Exception:
        return default


def _is_option_enabled(db: Session, code: str) -> bool:
    code = (code or "").strip()
    if code == "":
        return False
    stmt = (
        select(func.coalesce(SysOption.value, SysOption.default_value, ""))
        .where(SysOption.code == code)
        .limit(1)
    )
    val = db.execute(stmt).scalar_one_or_none()
    if val is None:
        return False
    val = str(val).strip()
    return val != "" and val != "0"


def _gen_code(length: int, source: str) -> str:
    source = source.strip() or "23456789"
    return "".join(random.choice(source) for _ in range(length))


def _render_png_base64(code: str, width: int, height: int) -> str:
    img = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()

    # 简单居中绘制
    text_w, text_h = draw.textsize(code, font=font)
    x = max((width - text_w) // 2, 0)
    y = max((height - text_h) // 2, 0)
    draw.text((x, y), code, fill=(0, 0, 0), font=font)

    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return "data:image/png;base64," + b64


@router.get("/captcha/image")
def get_image_captcha(db: Session = Depends(get_db)):
    expiration_minutes = 2
    expire_time_ms = int((time.time() + expiration_minutes * 60) * 1000)

    enabled = _is_option_enabled(db, "LOGIN_CAPTCHA_ENABLED")
    if not enabled:
        return ok({"uuid": "", "img": "", "expireTime": expire_time_ms, "isEnabled": False})

    try:
        # 生成 4 位数字验证码（与 Go 端一致）
        code = _gen_code(4, os.getenv("CAPTCHA_SOURCE") or "")
        uuid = os.urandom(16).hex()

        key = build_redis_key(uuid)
        redis_client.set(key, code, ex=expiration_minutes * 60)

        height = _getenv_int("CAPTCHA_IMG_HEIGHT", 60)
        width = _getenv_int("CAPTCHA_IMG_WIDTH", 200)
        img = _render_png_base64(code, width, height)
        return ok({"uuid": uuid, "img": img, "expireTime": expire_time_ms, "isEnabled": True})
    except Exception:
        return fail("500", "生成验证码失败")

