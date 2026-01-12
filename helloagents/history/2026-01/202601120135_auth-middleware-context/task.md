# 任务清单: 统一鉴权中间件（解析 JWT 并写入 Context）

目录: `helloagents/plan/202601120135_auth-middleware-context/`

---

## 1. 中间件实现
- [√] 1.1 新增 `backend-go/internal/interfaces/http/auth_middleware.go`：实现 `AuthContext` 与 `RequireUserID`/`GetUserID`

## 2. 路由分组
- [√] 2.1 修改 `backend-go/cmd/admin/main.go`：全局挂载 `AuthContext`，由各 handler 通过 `RequireUserID` 统一拦截

## 3. Handler 去重
- [√] 3.1 移除/替换各 handler 中 `currentUserID()`（dict/menu/role/dept/system_user/file/option/client/storage 等）
- [√] 3.2 对 `user_handler.go`、`online_handler.go` 等直接解析 token 的逻辑进行统一（改为使用 `RequireUserID`）

## 4. 安全检查
- [√] 4.1 执行安全检查（按G9: 权限控制、敏感信息处理、EHRB风险规避）

## 5. 知识库同步
- [√] 5.1 更新 `helloagents/wiki/arch.md` 与 `helloagents/wiki/modules/auth.md`、`helloagents/wiki/modules/system.md`
- [√] 5.2 更新 `helloagents/CHANGELOG.md`

## 6. 测试
- [√] 6.1 执行 `go test ./...`（backend-go）
