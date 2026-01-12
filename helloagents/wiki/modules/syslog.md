# 系统日志

## 目的
在 HTTP 层统一采集请求/响应与耗时，落库到 `sys_log`。

## 模块概述
- **职责:** 采集请求/响应头、body、状态码、耗时，并记录操作者 userId。
- **状态:** 🚧开发中
- **最后更新:** 2026-01-12

## 规范
### 需求: 日志敏感信息保护
**模块:** 系统日志
日志必须默认脱敏并限制大小，避免敏感信息与超大 body 落库。

#### 场景: 登录接口
对 `/auth/login` 默认不记录请求/响应 body（避免密码/token 落库）。
- 不写入敏感字段
- 仍可记录 method/path/status/duration

## 配置
- `LOG_BODY_MAX_BYTES`: body 最大采集字节数（默认 4096）；超过会被截断并追加 `...[TRUNCATED]`
- `LOG_SKIP_BODY_PATHS`: 逗号分隔的路径前缀列表（默认 `/auth/login`），匹配到则跳过请求/响应 body 采集

## 脱敏规则（默认）
- 请求/响应 header：`Authorization`、`Cookie`、`Set-Cookie`、`X-Token`、`X-Auth-Token` → `[REDACTED]`
- 请求 body：`multipart/form-data` 默认不采集（避免文件上传导致日志膨胀）

## 数据模型
### sys_log
| 字段 | 类型 | 说明 |
|------|------|------|
| request_headers | TEXT | 请求头（需脱敏） |
| request_body | TEXT | 请求体（需截断/可跳过） |
| response_body | TEXT | 响应体（需截断/可跳过） |

## 变更历史
- 202601120018_security-hardening-abc - 系统日志脱敏+截断+跳过策略
