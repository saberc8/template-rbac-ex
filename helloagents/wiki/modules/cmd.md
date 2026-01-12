# 后端入口与组装

## 目的
负责程序启动、依赖注入、路由注册与中间件装配。

## 模块概述
- **职责:** 读取环境变量配置、初始化 DB/Redis/Security、注册所有 HTTP 路由与 Swagger。
- **状态:** 🚧开发中
- **最后更新:** 2026-01-12

## 规范
### 需求: 启动配置安全
**模块:** 后端入口与组装
启动时必须校验关键配置，禁止在代码内设置默认密钥。

#### 场景: 缺少关键密钥
缺少 `AUTH_JWT_SECRET` 或 `AUTH_RSA_PRIVATE_KEY` 时启动失败并明确报错。
- 启动应直接退出
- 日志提示缺失项

## 配置
- **必填环境变量:**
  - `AUTH_RSA_PRIVATE_KEY_FILE`: RSA 私钥 PEM 文件路径（推荐，支持 PKCS#8/PKCS#1）
  - `AUTH_RSA_PRIVATE_KEY`: RSA 私钥（Base64，支持 PKCS#8/PKCS#1）
  - `AUTH_JWT_SECRET`: JWT 签名密钥
- **可选环境变量:** `DB_*`、`REDIS_*`、`HTTP_PORT` 等

## 启动指引
- 示例环境变量文件：`backend-go/.env.example`
- 后端启动文档：`backend-go/README.md`

## .env 自动加载（开发环境）
- `backend-go/cmd/admin` 启动时会自动尝试读取工作目录下的 `.env`
- 设置 `APP_ENV=production` 可禁用该行为（生产环境建议使用真实环境变量注入）

## 依赖
- infrastructure/db
- infrastructure/cache
- infrastructure/security
- interfaces/http

## 变更历史
- 202601120018_security-hardening-abc - 安全加固与分页优化
