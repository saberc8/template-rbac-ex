"""HTTP 层通用工具函数（时间格式、CSV 转义、文件路径规范化等）。"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional


def get_query_list(request, key: str) -> list[str]:
    qp = getattr(request, "query_params", None)
    if qp is None:
        return []

    raw_values: list[str] = []
    if hasattr(qp, "getlist"):
        raw_values.extend(qp.getlist(key))
        raw_values.extend(qp.getlist(f"{key}[]"))
    else:
        v = qp.get(key) if hasattr(qp, "get") else None
        if v is not None:
            raw_values.append(str(v))

    out: list[str] = []
    for raw in raw_values:
        for part in str(raw).split(","):
            p = part.strip()
            if p:
                out.append(p)
    return out


def format_time(dt: Optional[datetime]) -> str:
    if dt is None:
        return ""
    try:
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ""


def format_time_rfc3339(dt: Optional[datetime]) -> str:
    if dt is None:
        return ""
    try:
        if dt.tzinfo is None:
            local_tz = datetime.now().astimezone().tzinfo
            dt = dt.replace(tzinfo=local_tz)
        return dt.isoformat(timespec="seconds")
    except Exception:
        return ""


def parse_time_ymdhms(raw: str) -> Optional[datetime]:
    raw = (raw or "").strip()
    if raw == "":
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def escape_csv(val: str) -> str:
    val = val or ""
    if val == "":
        return ""
    if not any(ch in val for ch in [",", '"', "\n", "\r"]):
        return val
    return '"' + val.replace('"', '""') + '"'


def file_base_url_prefix() -> str:
    prefix = (os.getenv("FILE_BASE_URL") or "").strip()
    if prefix == "":
        prefix = "/file"
    if not prefix.startswith("/"):
        prefix = "/" + prefix
    return prefix.rstrip("/")


def build_local_file_url(path: str) -> str:
    path = (path or "").strip()
    if path == "":
        return ""
    if not path.startswith("/"):
        path = "/" + path
    return file_base_url_prefix() + path


def build_storage_file_url(storage, full_path: str) -> str:
    full_path = (full_path or "").strip()
    if full_path == "":
        return ""
    typ = getattr(storage, "type", None)
    if typ == 2:
        domain = (getattr(storage, "domain", None) or "").strip()
        if domain:
            domain = domain.rstrip("/")
            key = full_path.lstrip("/")
            return domain + "/" + key
    return build_local_file_url(full_path)


def normalize_parent_path(p: str) -> str:
    p = (p or "").strip()
    if p == "":
        return "/"
    if not p.startswith("/"):
        p = "/" + p
    if len(p) > 1:
        p = p.rstrip("/")
    return p


def extension_from_filename(name: str) -> str:
    name = (name or "").strip()
    if "." not in name:
        return ""
    ext = name.rsplit(".", 1)[-1].lower()
    return ext.strip(".")


def detect_file_type(ext: str, content_type: str) -> int:
    ext = (ext or "").strip().lower()
    content_type = (content_type or "").strip().lower()
    if content_type.startswith("image/"):
        return 2
    if content_type.startswith("video/"):
        return 4
    if content_type.startswith("audio/"):
        return 5
    if ext in {"jpg", "jpeg", "png", "gif"}:
        return 2
    if ext in {"doc", "docx", "xls", "xlsx", "ppt", "pptx", "pdf", "txt"}:
        return 3
    return 1
