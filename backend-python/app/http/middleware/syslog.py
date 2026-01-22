"""系统操作日志中间件：采集请求/响应信息并写入 sys_log（best-effort）。"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime
from typing import Callable, Iterable

from starlette.datastructures import URL

from app.core.id import next_id
from app.db.runtime import SessionLocal
from app.db.models.sys_log import SysLog


def _env_int(key: str, default: int) -> int:
    raw = (os.getenv(key) or "").strip()
    if raw == "":
        return default
    try:
        n = int(raw)
        return max(n, 0)
    except Exception:
        return default


def _env_csv(key: str, default: str) -> list[str]:
    raw = (os.getenv(key) or "").strip() or default
    if raw == "":
        return []
    out: list[str] = []
    for p in raw.split(","):
        p = p.strip()
        if p:
            out.append(p)
    return out


def _truncate(s: str, max_len: int) -> str:
    if max_len <= 0:
        return ""
    return s if len(s) <= max_len else s[:max_len]


def _is_sensitive_header(k: str) -> bool:
    k = (k or "").strip().lower()
    return k in {"authorization", "cookie", "set-cookie", "x-token", "x-auth-token"}


def _marshal_headers(headers: Iterable[tuple[bytes, bytes]]) -> str:
    m: dict[str, str] = {}
    for k_b, v_b in headers:
        k = k_b.decode("latin-1")
        v = v_b.decode("latin-1")
        if _is_sensitive_header(k):
            m[k] = "[REDACTED]"
        else:
            if k in m and m[k]:
                m[k] = m[k] + "," + v
            else:
                m[k] = v
    try:
        return json.dumps(m, ensure_ascii=False)
    except Exception:
        return ""


def _canonical_content_type(v: str) -> str:
    v = (v or "").strip()
    if v == "":
        return ""
    if ";" in v:
        v = v.split(";", 1)[0].strip()
    return v


def _format_body_sample(b: bytes, truncated: bool) -> str:
    if not b:
        return ""
    try:
        s = b.decode("utf-8", errors="replace")
    except Exception:
        s = ""
    if truncated:
        return s + "\n...[TRUNCATED]"
    return s


def _infer_module_and_desc(path: str, method: str) -> tuple[str, str]:
    if path.startswith("/auth/login"):
        return "登录", "用户登录"
    if path.startswith("/auth/logout"):
        return "登录", "用户退出登录"
    if path.startswith("/system/user"):
        return "用户管理", f"{method} /system/user"
    if path.startswith("/system/role"):
        return "角色管理", f"{method} /system/role"
    if path.startswith("/system/dept"):
        return "部门管理", f"{method} /system/dept"
    if path.startswith("/system/menu"):
        return "菜单管理", f"{method} /system/menu"
    if path.startswith("/system/dict"):
        return "字典管理", f"{method} /system/dict"
    if path.startswith("/system/option"):
        return "系统配置", f"{method} /system/option"
    if path.startswith("/system/storage"):
        return "存储配置", f"{method} /system/storage"
    if path.startswith("/system/client"):
        return "客户端配置", f"{method} /system/client"
    if path.startswith("/system/log"):
        return "系统日志", f"{method} /system/log"
    if path.startswith("/monitor/online"):
        return "在线用户", f"{method} /monitor/online"
    return "其它", f"{method} {path}"


class SysLogMiddleware:
    def __init__(self, app):
        self.app = app
        self.max_body_bytes = _env_int("LOG_BODY_MAX_BYTES", 4 * 1024)
        self.skip_body_prefix = _env_csv("LOG_SKIP_BODY_PATHS", "/auth/login")

    def _should_skip_body(self, path: str) -> bool:
        for p in self.skip_body_prefix:
            if p and path.startswith(p):
                return True
        return False

    async def __call__(self, scope, receive: Callable, send: Callable):
        if scope.get("type") != "http":
            return await self.app(scope, receive, send)

        method = (scope.get("method") or "").upper()
        if method == "OPTIONS":
            return await self.app(scope, receive, send)

        path = scope.get("path") or ""
        start = time.time()

        req_headers_raw = scope.get("headers") or []
        req_headers_json = _marshal_headers(req_headers_raw)

        # 采集请求体（仅在需要时；multipart 直接跳过）
        req_body_sample = b""
        req_body_truncated = False
        request_events = None

        content_type = ""
        for k_b, v_b in req_headers_raw:
            if k_b.lower() == b"content-type":
                content_type = v_b.decode("latin-1")
                break

        capture_req_body = self.max_body_bytes > 0 and (not self._should_skip_body(path))
        if capture_req_body and _canonical_content_type(content_type).lower().startswith("multipart/form-data"):
            capture_req_body = False

        if capture_req_body:
            request_events = []
            body_total = 0
            while True:
                message = await receive()
                request_events.append(message)
                if message.get("type") != "http.request":
                    if not message.get("more_body", False):
                        break
                    continue
                chunk: bytes = message.get("body", b"") or b""
                body_total += len(chunk)
                if not req_body_truncated and self.max_body_bytes > 0:
                    remain = (self.max_body_bytes + 1) - len(req_body_sample)
                    if remain > 0:
                        req_body_sample += chunk[:remain]
                    if len(req_body_sample) > self.max_body_bytes:
                        req_body_truncated = True
                if not message.get("more_body", False):
                    break

            # 重新喂给下游
            idx = 0

            async def _receive_replay():
                nonlocal idx
                if idx >= len(request_events):
                    return {"type": "http.request", "body": b"", "more_body": False}
                m = request_events[idx]
                idx += 1
                return m

            receive_to_use = _receive_replay
        else:
            receive_to_use = receive

        # 采集响应
        resp_status = 200
        resp_headers_raw: list[tuple[bytes, bytes]] = []
        resp_body_sample = b""
        resp_body_truncated = False
        capture_resp_body = self.max_body_bytes > 0 and (not self._should_skip_body(path))

        async def _send_capture(message):
            nonlocal resp_status, resp_headers_raw, resp_body_sample, resp_body_truncated
            if message.get("type") == "http.response.start":
                resp_status = int(message.get("status") or 200)
                resp_headers_raw = list(message.get("headers") or [])
            elif message.get("type") == "http.response.body":
                if capture_resp_body and not resp_body_truncated:
                    chunk: bytes = message.get("body", b"") or b""
                    remain = (self.max_body_bytes + 1) - len(resp_body_sample)
                    if remain > 0:
                        resp_body_sample += chunk[:remain]
                    if len(resp_body_sample) > self.max_body_bytes:
                        resp_body_truncated = True
            await send(message)

        try:
            await self.app(scope, receive_to_use, _send_capture)
        finally:
            duration_ms = int((time.time() - start) * 1000)

            # best-effort 写 sys_log（失败不影响主流程）
            try:
                url = str(URL(scope=scope))
                module, desc = _infer_module_and_desc(path, method)
                status_val = 2 if resp_status >= 400 else 1

                state = scope.get("state") or {}
                trace_id = (state.get("request_id") or "").strip()

                create_user = state.get("user_id")
                try:
                    create_user = int(create_user) if create_user is not None else None
                except Exception:
                    create_user = None

                ua = ""
                for k_b, v_b in req_headers_raw:
                    if k_b.lower() == b"user-agent":
                        ua = v_b.decode("latin-1")
                        break

                ip = ""
                if scope.get("client") and isinstance(scope["client"], (list, tuple)) and len(scope["client"]) >= 1:
                    ip = str(scope["client"][0] or "")

                with SessionLocal() as db:
                    rec = SysLog(
                        id=next_id(),
                        trace_id=_truncate(trace_id, 255),
                        description=_truncate(desc, 255),
                        module=_truncate(module, 100),
                        request_url=_truncate(url, 512),
                        request_method=_truncate(method, 10),
                        request_headers=req_headers_json,
                        request_body=_format_body_sample(req_body_sample[: self.max_body_bytes], req_body_truncated),
                        status_code=int(resp_status),
                        response_headers=_marshal_headers(resp_headers_raw),
                        response_body=_format_body_sample(resp_body_sample[: self.max_body_bytes], resp_body_truncated),
                        time_taken=int(duration_ms),
                        ip=_truncate(ip, 100),
                        address="",
                        browser=_truncate(ua, 100),
                        os="",
                        status=int(status_val),
                        error_msg="",
                        create_user=create_user,
                        create_time=datetime.fromtimestamp(start),
                    )
                    db.add(rec)
                    db.commit()
            except Exception:
                pass
