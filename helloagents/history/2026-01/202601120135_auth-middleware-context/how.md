# 技术设计: 统一鉴权中间件（解析 JWT 并写入 Context）

## 技术方案
### 核心技术
- Gin 中间件与路由分组
- `TokenService.Parse()` 解析 JWT

### 实现要点
- 新增 `AuthRequired(tokenSvc)` 中间件：
  - 从 `Authorization` 读取并解析 token
  - 失败：返回 `Fail(c,"401","未授权，请重新登录")` 并 `Abort()`
  - 成功：`c.Set("userID", claims.UserID)` 后继续
- 提供 `GetUserID(c)` 辅助方法：
  - 从 `c.Get("userID")` 读取并做类型断言
- 在 `cmd/admin/main.go` 中调整路由注册：
  - public：登录、验证码、Swagger、静态文件等
  - auth：系统管理、监控、需要登录的业务接口
- 各 Handler 删除 `currentUserID()`，改为 `GetUserID(c)`。

## 架构决策 ADR
### ADR-005: 鉴权由中间件统一完成并写入 Context
**上下文:** 多个 handler 重复解析 token，容易出现不一致与维护成本。
**决策:** 统一鉴权中间件，集中处理 token 校验与 userID 注入。
**理由:** 消除重复、提高一致性，便于后续扩展权限/审计。
**替代方案:** 保持每个 handler 自行解析 → 拒绝原因: 重复与不一致风险持续存在。
**影响:** 需要梳理路由分组与保护范围。

## 测试与部署
- **测试:** `go test ./...`（backend-go）
- **部署:** 无新增环境变量

