# auth

## 目的
提供登录/注销、验证码、JWT 认证与在线用户能力。

## 模块概述
- **职责:** 登录鉴权、Token 生成与校验、验证码发放与校验、在线用户维护
- **状态:** ✅稳定
- **最后更新:** 2026-01-11

## 规范

### 需求: 用户登录并获取 JWT
**模块:** auth
用户提交账号密码（及验证码）后，系统签发 JWT 并允许后续访问受保护接口。

#### 场景: 登录
请求 `POST /auth/login`。
- 验证通过后返回 token
- 失败时返回统一错误结构

### 需求: 提供图片验证码
**模块:** auth
用于登录前的人机校验与防刷。

#### 场景: 获取验证码图片
请求 `GET /captcha/image`。
- 返回图片验证码（及关联标识，以接口实现为准）

## API接口
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/user/info`
- `GET /auth/user/route`
- `GET /captcha/image`

## 数据模型
主要表与关联：
- `sys_user`（用户）
- `sys_user_role`（用户角色）
- `sys_role` / `sys_menu` / `sys_role_menu`（用于路由与权限）

## 依赖
- Redis（验证码与缓存相关能力）

## 变更历史
- 知识库初始化（202601112319） - 认证模块文档初始化

