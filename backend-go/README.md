# voc-go-backend（Go 后端）

## 1. 前置依赖
- Go（建议 1.21+）
- PostgreSQL（本地或容器）
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
- `DB_*`：PostgreSQL 连接配置
- `REDIS_*`：Redis 连接配置

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

启动成功后：
- Swagger：`http://localhost:${HTTP_PORT}/swagger/index.html`

## 4. 常用命令

```bash
go test ./...
```
