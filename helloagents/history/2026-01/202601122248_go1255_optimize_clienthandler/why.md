# 变更提案: Go 1.25.5 升级与客户端列表优化

## 需求背景
当前后端 `backend-go` 的 `go.mod` 仍为 `go 1.24.0`，且存在若干基础质量问题与可改进点：
1. 基础质量：部分文件未 `gofmt`，并存在 `panic(err)` 等不符合生产习惯的错误处理方式。
2. 客户端管理：`/system/client` 列表接口对查询参数解析不严格，且 `status=0` 无法正确筛选；`auth_type` 目前采用 JSON 文本模糊匹配，结果不精确且性能不可控。

本变更在升级 Go 版本的同时，优先完成 A) 基础质量与 B) `client_handler` 的参数校验与 SQL 优化，并补充相应测试。

## 变更内容
1. 将 `backend-go/go.mod` 的 Go 版本升级到 `1.25.5`，并启用 `toolchain go1.25.5`。
2. 执行 `gofmt`、消除 `panic(err)` 等基础质量问题。
3. 优化 `client_handler`：
   - 严格处理分页/筛选参数（非法参数返回 400）。
   - 修复 `status=0` 无法筛选的问题。
   - 将 `auth_type` 筛选从“模糊匹配”改为“精确匹配（jsonb containment）”，并为其添加索引支持。
4. 为以上变更补充测试用例，确保 `go test ./...` 通过。

## 影响范围
- **模块:**
  - `backend-go`（HTTP 接口、DB 迁移、开发工具链）
- **文件:**
  - `backend-go/go.mod`
  - `backend-go/go.sum`
  - `backend-go/internal/interfaces/http/client_handler.go`
  - `backend-go/internal/infrastructure/db/migrate.go`
  - `backend-go/cmd/test_menus/main.go`
  - `backend-go/internal/interfaces/http/client_handler_test.go`（新增）
- **API:**
  - `GET /system/client`：参数校验更严格；`authType`/`status` 的筛选逻辑更精确
- **数据:**
  - `sys_client.auth_type`：增加 GIN 索引（表达式索引，基于 `auth_type::jsonb`）

## 核心场景

### 需求: Go 版本升级与工具链锁定
**模块:** backend-go
升级 `go.mod` 的 Go 版本并锁定 toolchain，确保本地与 CI 行为一致。

#### 场景: 构建与测试
在 Go 1.25.5 下执行 `go test ./...` 应通过。
- 预期结果：依赖解析正常，测试全部通过

### 需求: 客户端列表参数解析与筛选修复
**模块:** interfaces/http
对 `page/size/status/authType` 做严格解析与更精确的 SQL 筛选。

#### 场景: status=0 筛选
当请求携带 `status=0` 时，应能筛选出 `status=0` 的客户端记录。
- 预期结果：SQL WHERE 包含 `c.status = $n` 且参数为 0

#### 场景: authType 精确筛选
当请求携带 `authType=ACCOUNT` 时，只匹配 `auth_type` 数组包含 `ACCOUNT` 的记录。
- 预期结果：使用 `auth_type::jsonb @> '["ACCOUNT"]'::jsonb` 语义的筛选

## 风险评估
- **风险:** Go 版本升级可能触发间接依赖变化（`go mod tidy`）。
  - **缓解:** 升级后立即执行 `go test ./...` 与 `go vet ./...`，并尽量保持对外接口不变。
- **风险:** `auth_type` 筛选由模糊匹配改为精确匹配可能影响查询结果。
  - **缓解:** 明确记录行为变化并补充测试覆盖关键场景；添加索引减少性能回退风险。

