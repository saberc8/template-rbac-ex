# Changelog

本文件记录项目所有重要变更。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- 创建 HelloAGENTS 知识库（`helloagents/`），用于作为项目知识 SSOT。

### 变更
- 字典项分页查询下推到 SQL 层，避免内存分页带来的性能问题。
- 字典模块分层重构：`DictHandler` 改为调用 `application/dict` Service，并由 `persistence/dict` 负责 SQL。
- 统一鉴权：新增 `AuthContext` 中间件写入 `userID` 到 Gin Context，并移除各 Handler 重复的 token 解析代码。
- 开发体验：`cmd/admin` 默认加载 `.env`（可用 `APP_ENV=production` 禁用），避免手动 `source` 环境变量。
- 兼容性：`AUTH_RSA_PRIVATE_KEY` 支持 PKCS#8/PKCS#1 两种 DER Base64 编码格式。
- 部署体验：支持 `AUTH_RSA_PRIVATE_KEY_FILE` 直接读取 PEM 私钥（优先于 `AUTH_RSA_PRIVATE_KEY`）。
- 登录验证码：`/captcha/image` 默认生成更清晰的验证码图片，并支持 `CAPTCHA_*` 环境变量微调参数。

### 安全
- 系统日志默认脱敏 `Authorization/Cookie` 等敏感 header，并对请求/响应 body 进行截断与敏感路径跳过。
- 启动时强制要求配置 `AUTH_RSA_PRIVATE_KEY` 与 `AUTH_JWT_SECRET`，不再提供代码内置默认值。
