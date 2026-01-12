# 任务清单: Go 1.25.5 升级与客户端列表优化

目录: `helloagents/plan/202601122248_go1255_optimize_clienthandler/`

---

## 1. 工具链升级（Go）
- [√] 1.1 更新 `backend-go/go.mod`：`go 1.25.5` + `toolchain go1.25.5`，执行 `go mod tidy` 并确保能通过编译，验证 why.md#需求-go-版本升级与工具链锁定-场景-构建与测试

## 2. 基础质量（A）
- [√] 2.1 对 `backend-go` 执行 `gofmt`，清理格式差异
- [√] 2.2 在 `backend-go/cmd/test_menus/main.go` 中移除 `panic(err)`，改为可读的错误输出并非 0 退出

## 3. 客户端列表优化（B）
- [√] 3.1 在 `backend-go/internal/interfaces/http/client_handler.go` 中完善分页参数解析：非法参数返回 400
- [√] 3.2 在 `backend-go/internal/interfaces/http/client_handler.go` 中修复 `status=0` 无法筛选（引入“是否传参”的标记）
- [√] 3.3 在 `backend-go/internal/interfaces/http/client_handler.go` 中将 `authType` 筛选从 `ILIKE` 改为 `auth_type::jsonb @> $n::jsonb` 精确匹配（任意匹配 OR），验证 why.md#需求-客户端列表参数解析与筛选修复-场景-authtype-精确筛选
- [√] 3.4 在 `backend-go/internal/infrastructure/db/migrate.go` 的 `ensureSysClient` 中补充 `auth_type` 的 GIN 表达式索引创建（幂等）

## 4. 测试（补充）
- [√] 4.1 新增 `backend-go/internal/interfaces/http/client_handler_test.go`：覆盖
  - 非法 `page/size/status` 返回 400
  - `status=0` 会生成带条件的 SQL 且参数为 0
  - `authType=ACCOUNT` 会生成 jsonb containment 的 SQL 条件
- [√] 4.2 运行 `go test ./...` 与 `go vet ./...`，确保通过

## 5. 文档与收尾
- [√] 5.1 更新 `helloagents/CHANGELOG.md` 记录本次变更
- [√] 5.2 更新 `helloagents/wiki/modules/system.md` 记录 `GET /system/client` 行为变化点
- [√] 5.3 迁移方案包到 `helloagents/history/2026-01/` 并更新 `helloagents/history/index.md`
