# 技术设计: Go 1.25.5 升级与客户端列表优化

## 技术方案

### 核心技术
- Go `1.25.5`（`go.mod` 同步升级 + `toolchain` 锁定）
- Gin HTTP handlers
- PostgreSQL（`database/sql` + `lib/pq`）
- 单元测试：`testing` + `httptest` + `sqlmock`

### 实现要点
- Go 升级：
  - `backend-go/go.mod` 将 `go` 指令更新到 `1.25.5`
  - 增加 `toolchain go1.25.5`，在开发与 CI 上保持一致的 toolchain 行为
  - 执行 `go mod tidy` 更新间接依赖与 `go.sum`
- 基础质量：
  - 对 `backend-go` 执行 `gofmt`，修复格式化差异
  - 将 `panic(err)` 改为更明确的错误输出并返回非 0 退出码
- `client_handler`：
  - Query 参数解析：当参数显式提供但无法解析/越界时，返回 `Fail(code="400")`
  - `status` 筛选：使用“是否传参”的标志位，避免 `0` 被当作“未筛选”
  - `authType` 筛选：
    - 对输入进行 `TrimSpace`、去空、去重
    - SQL 使用 `c.auth_type::jsonb @> $n::jsonb` 的 OR 组合实现“任意匹配”
    - 参数使用 `["<TYPE>"]` 的 JSON 字符串，确保语义精确
  - 性能：在迁移中补充 `GIN ((auth_type::jsonb))` 表达式索引（`IF NOT EXISTS`）

## 架构决策 ADR

### ADR-006: sys_client.auth_type 采用 jsonb containment 实现精确筛选
**上下文:** `auth_type` 存储为 JSON 数组，当前使用 `::text ILIKE '%x%'` 进行模糊匹配，存在误匹配风险且难以优化性能。
**决策:** 在查询中使用 `auth_type::jsonb @> '["X"]'::jsonb` 实现精确的“包含元素”筛选，并增加 `GIN ((auth_type::jsonb))` 索引。
**理由:** 语义精确、参数化安全、可被索引优化；对前端接口保持不变。
**替代方案:** 保持 `ILIKE` 模糊匹配 → 拒绝原因：误匹配与性能不可控。
**影响:** 筛选结果更精确（可能改变既有查询结果），需要补充测试并在变更记录中说明。

## 数据模型
- 不修改表结构字段类型（仍为 `JSON`），仅新增索引：
  - `CREATE INDEX IF NOT EXISTS ... USING GIN ((auth_type::jsonb));`

## 安全与性能
- **安全:** 所有查询参数均采用参数化（避免 SQL 注入）；输入做 trim/去空/去重，避免异常构造。
- **性能:** 通过 jsonb containment + GIN 表达式索引降低过滤开销；分页 limit/offset 继续下推到 SQL。

## 测试与部署
- **测试:**
  - `client_handler`：覆盖参数校验、`status=0` 筛选、`authType` 精确筛选的 SQL 生成与返回结构
  - 运行：`go test ./...`、`go vet ./...`
- **部署:**
  - 该服务启动时会执行 `AutoMigrate`：索引创建为幂等操作；升级前建议在预发布环境先验证查询行为变化

