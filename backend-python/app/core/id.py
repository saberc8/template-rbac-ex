"""进程内 ID 生成器：按毫秒单调递增（对齐 backend-go/internal/infrastructure/id）。"""

from __future__ import annotations

import threading
import time

_lock = threading.Lock()
_last: int = 0


def next_id() -> int:
    global _last
    with _lock:
        now = int(time.time() * 1000)
        if now <= _last:
            _last += 1
        else:
            _last = now
        return _last
