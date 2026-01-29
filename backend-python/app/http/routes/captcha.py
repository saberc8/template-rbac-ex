"""验证码接口：GET /captcha/image。"""

from __future__ import annotations

import base64
import logging
import os
import random
import time
from io import BytesIO
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.captcha import (
    build_redis_key,
    set_code_in_memory,
)
from app.db.models.sys_option import SysOption
from app.http.deps import get_db
from app.http.response import fail, ok
from app.runtime import redis_client, settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _getenv_int(key: str, default: int) -> int:
    raw = (os.getenv(key) or "").strip()
    if raw == "":
        return default
    try:
        v = int(raw)
        return v if v > 0 else default
    except Exception:
        return default


def _is_option_enabled(db: Optional[Session], code: str) -> bool:
    code = (code or "").strip()
    if code == "":
        return False
    if db is None:
        return False
    stmt = select(func.coalesce(SysOption.value, SysOption.default_value, "")).where(SysOption.code == code).limit(1)
    val = db.execute(stmt).scalar_one_or_none()
    if val is None:
        return False
    val = str(val).strip()
    return val != "" and val != "0"


def _gen_code(length: int, source: str) -> str:
    source = source.strip() or "23456789"
    return "".join(random.choice(source) for _ in range(length))  # nosec B311


def _try_load_captcha_truetype_font(size: int) -> Optional[ImageFont.ImageFont]:
    # Pillow wheel 通常自带 DejaVu 字体：PIL/fonts/*.ttf
    try:
        import PIL  # type: ignore

        pil_dir = Path(PIL.__file__).resolve().parent
        fonts_dir = pil_dir / "fonts"
        for name in ("DejaVuSans.ttf",):
            p = fonts_dir / name
            if p.exists():
                return ImageFont.truetype(str(p), size=size)
    except Exception:
        pass

    # 常见系统字体路径（macOS/Linux），避免在容器/最小环境中完全依赖外部文件。
    candidates = [
        # Linux (Debian/Ubuntu 常见)
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        # macOS
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttf",
    ]
    for p in candidates:
        try:
            if Path(p).exists():
                return ImageFont.truetype(p, size=size)
        except Exception:
            continue

    # 最后尝试按名称加载（依赖系统 fontconfig/字体缓存）
    for name in ("DejaVuSans.ttf", "Arial.ttf", "Helvetica.ttf"):
        try:
            return ImageFont.truetype(name, size=size)
        except Exception:
            continue

    return None


def _render_png_base64(code: str, width: int, height: int) -> str:
    img = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # 目标：文字更大、边距更紧凑，避免“白边过大导致验证码难以辨认”。
    pad_x = max(4, width // 40)
    pad_y = max(3, height // 14)
    avail_w = max(width - 2 * pad_x, 1)
    avail_h = max(height - 2 * pad_y, 1)

    # 初始字体大小按高度估算，并确保在可用区域内自适应。
    target_size = max(14, int(height * 0.86))

    truetype_font = _try_load_captcha_truetype_font(target_size)
    if truetype_font is not None:
        left = top = 0
        text_w = width
        text_h = height
        font: ImageFont.ImageFont = truetype_font

        # Pillow >= 10 移除了 textsize，优先使用 textbbox；同时兼容旧版本。
        for size in range(target_size, 10, -1):
            font = _try_load_captcha_truetype_font(size) or truetype_font
            try:
                left, top, right, bottom = draw.textbbox(
                    (0, 0),
                    code,
                    font=font,
                )
                text_w = right - left
                text_h = bottom - top
            except Exception:
                text_w, text_h = draw.textsize(code, font=font)  # type: ignore[attr-defined]
                left = 0
                top = 0

            if text_w <= avail_w and text_h <= avail_h:
                break

        # bbox 可能带负偏移，需减去 left/top 才能真正居中。
        x = (width - text_w) // 2 - left
        y = (height - text_h) // 2 - top
        x = max(pad_x, min(x, width - text_w - pad_x))
        y = max(pad_y, min(y, height - text_h - pad_y))

        draw.text(
            (x, y),
            code,
            fill=(20, 20, 20),
            font=font,
        )
    else:
        # 兜底：若环境没有可用 TrueType 字体，则用默认 bitmap font 先渲染，再整体等比放大到占满可用区域。
        font = ImageFont.load_default()
        try:
            left, top, right, bottom = draw.textbbox((0, 0), code, font=font)
            text_w = max(right - left, 1)
            text_h = max(bottom - top, 1)
        except Exception:
            text_w, text_h = draw.textsize(code, font=font)  # type: ignore[attr-defined]
            left = 0
            top = 0
            text_w = max(text_w, 1)
            text_h = max(text_h, 1)

        mask = Image.new("L", (text_w + 2, text_h + 2), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.text((1 - left, 1 - top), code, fill=255, font=font)

        scale = min(avail_w / text_w, avail_h / text_h)
        scale = max(scale, 1.0)
        new_w = max(int(text_w * scale), 1)
        new_h = max(int(text_h * scale), 1)

        # NEAREST 保持边缘清晰（避免放大后模糊）
        mask = mask.resize((new_w, new_h), resample=Image.NEAREST)
        x = (width - new_w) // 2
        y = (height - new_h) // 2
        x = max(pad_x, min(x, width - new_w - pad_x))
        y = max(pad_y, min(y, height - new_h - pad_y))

        ink = Image.new("RGB", (new_w, new_h), (20, 20, 20))
        img.paste(ink, (x, y), mask)

    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return "data:image/png;base64," + b64


@router.get("/captcha/image")
def get_image_captcha(db: Optional[Session] = Depends(get_db)):
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
        ttl_seconds = expiration_minutes * 60
        try:
            redis_client.set(key, code, ex=ttl_seconds)
        except Exception:
            # 本地/开发环境兜底：Redis 未启动时使用进程内存存储，保证联调可用。
            # 生产环境禁止兜底（多进程/多副本不一致），保持失败以提示运维修复 Redis。
            if settings.app_env in {"prod", "production"}:
                raise
            set_code_in_memory(key, code, ttl_seconds)

        height = _getenv_int("CAPTCHA_IMG_HEIGHT", 60)
        width = _getenv_int("CAPTCHA_IMG_WIDTH", 200)
        img = _render_png_base64(code, width, height)
        return ok({"uuid": uuid, "img": img, "expireTime": expire_time_ms, "isEnabled": True})
    except Exception:
        logger.exception("captcha generation failed")
        return fail("500", "生成验证码失败")
