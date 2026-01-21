# Changelog

本文件记录项目所有重要变更。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- 创建 HelloAGENTS 知识库（`helloagents/`），用于作为项目知识 SSOT。
- 为 `GET /system/client` 增加基础单测（参数校验与筛选 SQL 断言）。
- 为自动迁移与验证码 Redis store 补充单测（含 miniredis）。

### 变更
- Go：`backend-go` 升级到 `go 1.25.5` 并锁定 `toolchain go1.25.5`。
- 字典项分页查询下推到 SQL 层，避免内存分页带来的性能问题。
- 字典模块分层重构：`DictHandler` 改为调用 `application/dict` Service，并由 `persistence/dict` 负责 SQL。
- 统一鉴权：新增 `AuthContext` 中间件写入 `userID` 到 Gin Context，并移除各 Handler 重复的 token 解析代码。
- 开发体验：`cmd/admin` 默认加载 `.env`（可用 `APP_ENV=production` 禁用），避免手动 `source` 环境变量。
- 兼容性：`AUTH_RSA_PRIVATE_KEY` 支持 PKCS#8/PKCS#1 两种 DER Base64 编码格式。
- 部署体验：支持 `AUTH_RSA_PRIVATE_KEY_FILE` 直接读取 PEM 私钥（优先于 `AUTH_RSA_PRIVATE_KEY`）。
- 登录验证码：`/captcha/image` 默认生成更清晰的验证码图片，并支持 `CAPTCHA_*` 环境变量微调参数。
- 系统管理：`GET /system/client` 参数校验更严格；`status=0` 可筛选；`authType` 筛选改为 `jsonb` 精确包含匹配并增加索引。
- 开发体验：`cmd/test_menus` 移除 `panic(err)`，改为明确输出错误并返回非 0 退出码。
- 基础设施：自动迁移新增 `AutoMigrateContext(ctx, db)` 并在事务内执行（统一 `ExecContext/QueryRowContext`）。
- 登录验证码：验证码生成存储统一为 Redis-backed store，移除内存+Redis 双写（与登录校验一致）。

### 安全
- 系统日志默认脱敏 `Authorization/Cookie` 等敏感 header，并对请求/响应 body 进行截断与敏感路径跳过。
- 启动时强制要求配置 `AUTH_RSA_PRIVATE_KEY` 与 `AUTH_JWT_SECRET`，不再提供代码内置默认值。
