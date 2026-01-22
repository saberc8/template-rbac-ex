# go-backend（Go 后端）

## 1. 前置依赖
- Go（建议 1.21+）
- PostgreSQL / MySQL（本地或容器，使用 `DB_DIALECT` 切换）
- Redis（用于验证码等缓存）

## 2. 环境变量
复制示例文件并填写必需项：

```bash
cp .env.example .env
```

`cmd/admin` 启动时会自动尝试加载当前工作目录下的 `.env`（开发环境便利性），可通过设置 `APP_ENV=production` 禁用。

### 必填
- `AUTH_JWT_SECRET`：JWT 签名密钥

⚠️ 安全提示：密码/密钥字段不再使用 RSA 加密，生产环境请务必启用 HTTPS，避免明文在传输层泄露。

### 常用
- `HTTP_PORT`：服务端口（默认 14398）
- `DB_DIALECT`：数据库类型（`postgres`/`mysql`）
- `DB_*`：数据库连接配置（PostgreSQL/MySQL）
- `REDIS_*`：Redis 连接配置
- `DB_AUTO_MIGRATE`：是否在 `cmd/admin` 启动时自动执行迁移（生产环境默认关闭；开发环境默认开启，可显式设置 `0/false` 关闭）

### 验证码（可选）
`/captcha/image` 默认生成更清晰的纯数字验证码，可通过以下环境变量调整参数：
- `CAPTCHA_IMG_HEIGHT` / `CAPTCHA_IMG_WIDTH`
- `CAPTCHA_NOISE_COUNT` / `CAPTCHA_SHOW_LINE_OPTIONS`
- `CAPTCHA_SOURCE`（默认 `23456789`）

### 系统日志（可选）
- `LOG_BODY_MAX_BYTES`：请求/响应 body 采集上限（默认 4096）
- `LOG_SKIP_BODY_PATHS`：逗号分隔路径前缀列表（默认 `/auth/login`，匹配则跳过 body 采集）

## 3. 启动

```bash
go run ./cmd/admin
```

生产/发布流程建议显式执行迁移：

```bash
go run ./cmd/migrate
go run ./cmd/admin
```

启动成功后：
- Swagger：`http://localhost:${HTTP_PORT}/swagger/index.html`

## 4. 常用命令

```bash
go test ./...
```

INSERT INTO "public"."sys_storage" ("id", "name", "code", "type", "access_key", "secret_key", "endpoint", "region", "bucket_name", "domain", "description", "is_default", "sort", "status", "create_user", "create_time", "update_user", "update_time") VALUES (1, '开发环境', 'local_dev', 1, '', '', '', '', './data/file/', '/file/', '本地存储', 'f', 1, 1, 1, '2026-01-21 19:52:35.098207', 1, '2026-01-21 20:07:16.590038');
INSERT INTO "public"."sys_storage" ("id", "name", "code", "type", "access_key", "secret_key", "endpoint", "region", "bucket_name", "domain", "description", "is_default", "sort", "status", "create_user", "create_time", "update_user", "update_time") VALUES (1768650694031, 'minio', 'minio', 2, 'zY5Ira7K8FjSNY3ozjxz', 'MwNCJ3UCNxqpaNnLYzXfapPRB4gObq7KV4zqXdXK', 'http://127.0.0.1:9000', '', 'aicut', 'http://127.0.0.1:9000/aicut', '', 't', 999, 1, 1, '2026-01-17 19:51:34.03154', 1, '2026-01-21 20:07:31.73795');
