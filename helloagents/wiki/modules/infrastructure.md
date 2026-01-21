# 基础设施

## 目的
提供 DB/Redis/Security/ID/迁移等基础设施能力。

## 模块概述
- **职责:** PostgreSQL 连接池、自动迁移、Redis 客户端、JWT/RSA/密码学组件、进程内 ID 生成。
- **状态:** 🚧开发中
- **最后更新:** 2026-01-12

## 关键约定
- 自动迁移：推荐通过 `AutoMigrateContext(ctx, db)` 执行，以支持超时/取消；`AutoMigrate(db)` 为兼容包装。
- 迁移一致性：迁移默认在同一事务中执行（幂等 DDL + seed），避免出现半完成状态；如未来需要 `CREATE INDEX CONCURRENTLY` 等非事务语句，需要拆分到事务外执行。

## 依赖
- `github.com/lib/pq`
- `github.com/redis/go-redis/v9`
- `github.com/golang-jwt/jwt/v5`

## 变更历史
- 202601120018_security-hardening-abc - 启动配置校验与日志策略涉及
 - 202601122347_migrate_ctx_tx_captcha_redis - 自动迁移 Context/事务化执行；验证码存储统一为 Redis
