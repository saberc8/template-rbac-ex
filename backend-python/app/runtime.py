"""运行时单例：Settings / TokenService / Redis 客户端。"""

from __future__ import annotations

import redis

from app.config import load_settings
from app.http.online_store import OnlineStore
from app.security.jwt import TokenService


settings = load_settings()
token_service = TokenService(settings.auth_jwt_secret, ttl_seconds=24 * 60 * 60)

# 注意：Redis 连接为惰性建立；未启动 Redis 时，仅在实际使用时才会报错。
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

# 在线用户：仅当前进程有效
online_store = OnlineStore()
