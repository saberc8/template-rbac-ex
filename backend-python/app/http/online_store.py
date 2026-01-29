"""在线用户内存存储（仅当前进程有效，行为对齐 Go OnlineStore）。"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class OnlineSession:
    user_id: int
    username: str
    nickname: str
    token: str
    client_type: str
    client_id: str
    ip: str
    address: str
    browser: str
    os: str
    login_time: datetime
    last_active_time: datetime


class OnlineStore:
    def __init__(self):
        self._lock = threading.RLock()
        self._sessions: dict[str, OnlineSession] = {}

    def record_login(
        self,
        *,
        user_id: int,
        username: str,
        nickname: str,
        client_id: str,
        token: str,
        ip: str,
        user_agent: str,
    ) -> None:
        if user_id <= 0 or not token:
            return
        now = datetime.now()
        with self._lock:
            self._sessions[token] = OnlineSession(
                user_id=user_id,
                username=username or "",
                nickname=nickname or "",
                token=token,
                client_type="PC",
                client_id=client_id or "",
                ip=ip or "",
                address="",
                browser=user_agent or "",
                os="",
                login_time=now,
                last_active_time=now,
            )

    def remove_by_token(self, token: str) -> None:
        token = (token or "").strip()
        if token == "":
            return
        with self._lock:
            self._sessions.pop(token, None)

    def list(
        self,
        *,
        nickname: str,
        login_start: Optional[datetime],
        login_end: Optional[datetime],
        page: int,
        size: int,
    ) -> tuple[list[dict], int]:
        nickname = (nickname or "").strip()
        if page <= 0:
            page = 1
        if size <= 0:
            size = 10

        with self._lock:
            filtered: list[OnlineSession] = []
            for sess in self._sessions.values():
                if nickname and (nickname not in sess.username and nickname not in sess.nickname):
                    continue
                if login_start and sess.login_time < login_start:
                    continue
                if login_end and sess.login_time > login_end:
                    continue
                filtered.append(sess)

        filtered.sort(key=lambda s: s.login_time, reverse=True)
        total = len(filtered)
        start = (page - 1) * size
        if start > total:
            start = total
        end = min(start + size, total)

        def _fmt(dt: datetime) -> str:
            return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else ""

        out: list[dict] = []
        for sess in filtered[start:end]:
            out.append(
                {
                    "id": sess.user_id,
                    "token": sess.token,
                    "username": sess.username,
                    "nickname": sess.nickname,
                    "clientType": sess.client_type,
                    "clientId": sess.client_id,
                    "ip": sess.ip,
                    "address": sess.address,
                    "browser": sess.browser,
                    "os": sess.os,
                    "loginTime": _fmt(sess.login_time),
                    "lastActiveTime": _fmt(sess.last_active_time),
                }
            )
        return out, total
