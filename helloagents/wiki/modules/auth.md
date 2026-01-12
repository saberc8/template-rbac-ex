# 认证与用户信息

## 目的
提供登录认证、JWT 颁发与解析、用户信息与路由树构建。

## 模块概述
- **职责:** 登录校验、JWT 生成/解析、聚合角色与权限、构建前端路由树。
- **状态:** 🚧开发中
- **最后更新:** 2026-01-12

## 鉴权机制（后端实现）
- 全局中间件 `AuthContext`：解析 `Authorization`，如 token 合法则写入 `userID` 到 Gin Context。
- 需要登录的接口在 handler 内调用 `RequireUserID` 统一返回 401（避免每个 handler 重复解析 token）。

## API接口
### POST /auth/login
**描述:** 账号登录，返回 token。

### GET /captcha/image
**描述:** 获取登录图片验证码（前端是否展示由后端配置决定）。

**开关配置:**
- `sys_option.code = LOGIN_CAPTCHA_ENABLED`
  - `0`：关闭验证码（接口返回 `isEnabled=false`，前端隐藏输入框）
  - 非 `0`：开启验证码（接口返回 `uuid` + `img`）

**可读性优化（后端实现）:**
- 默认生成更清晰的纯数字验证码（不修改前端接口）
- 可通过环境变量微调：`CAPTCHA_IMG_HEIGHT`、`CAPTCHA_IMG_WIDTH`、`CAPTCHA_NOISE_COUNT`、`CAPTCHA_SHOW_LINE_OPTIONS`、`CAPTCHA_SOURCE`

### GET /auth/user/info
**描述:** 返回用户信息、角色与权限集合。

### GET /auth/user/route
**描述:** 返回当前用户可见的菜单路由树。

## 依赖
- domain/user
- domain/rbac
- infrastructure/security
- infrastructure/persistence/*

## 变更历史
- 202601120018_security-hardening-abc - 系统日志脱敏与启动配置校验关联改动
- 202601120135_auth-middleware-context - 统一鉴权中间件与 userID Context 注入
