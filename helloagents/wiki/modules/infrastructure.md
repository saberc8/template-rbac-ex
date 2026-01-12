# 基础设施

## 目的
提供 DB/Redis/Security/ID/迁移等基础设施能力。

## 模块概述
- **职责:** PostgreSQL 连接池、自动迁移、Redis 客户端、JWT/RSA/密码学组件、进程内 ID 生成。
- **状态:** 🚧开发中
- **最后更新:** 2026-01-12

## 依赖
- `github.com/lib/pq`
- `github.com/redis/go-redis/v9`
- `github.com/golang-jwt/jwt/v5`

## 变更历史
- 202601120018_security-hardening-abc - 启动配置校验与日志策略涉及

