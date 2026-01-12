# 变更提案: 统一鉴权中间件（解析 JWT 并写入 Context）

## 需求背景
当前多个 HTTP Handler 里重复实现了 `currentUserID()`：
- 读取 `Authorization` header
- 调用 `tokenSvc.Parse()`
- 失败时返回 `401` 并中断

重复代码带来维护成本与一致性风险（错误码/文案/边界处理不一致），也不利于后续扩展统一的权限校验与审计字段注入。

## 变更内容
1. 新增统一鉴权中间件：解析 JWT，并将 `userID` 写入 Gin Context。
2. 在需要登录的路由组上挂载该中间件。
3. 删除/替换各 Handler 内重复的 `currentUserID()` 逻辑，改为从 Context 取 `userID`。

## 影响范围
- **模块:** interfaces/http（鉴权与路由注册）
- **文件（预期新增/修改）:**
  - `backend-go/internal/interfaces/http/auth_middleware.go`（新增）
  - `backend-go/cmd/admin/main.go`（路由组调整）
  - `backend-go/internal/interfaces/http/*_handler.go`（移除 currentUserID 重复逻辑）

## 核心场景

### 需求: 需要登录的接口统一鉴权
**模块:** 系统管理 / 监控
所有需要登录的接口应由中间件统一校验 token。

#### 场景: 未携带或携带无效 token
请求任一受保护接口：
- 返回 `code=401`、`msg=未授权，请重新登录`
- 不进入业务 handler

#### 场景: 通过鉴权后读取 userID
请求受保护接口且 token 有效：
- handler 可从 context 获取 `userID`
- 行为与之前 `currentUserID()` 一致

## 风险评估
- **风险:** 路由组划分不当导致“原本公开的接口”被误加保护或反之。
- **缓解:** 明确区分 public/auth-required 两类路由；改动后以登录/系统管理/监控接口做手工回归验证。

