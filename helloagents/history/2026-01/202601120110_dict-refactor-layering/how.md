# 技术设计: 字典模块分层重构（Handler → Service → Repository）

## 技术方案
### 核心技术
- Go 分包分层（application / infrastructure / interfaces）
- `database/sql` 参数化查询与事务

### 实现要点
- 定义 `dict.Repository` 接口（位于 `internal/application/dict`），覆盖：
  - 字典：list/get/create/update/delete（含关联删除 dict_item）
  - 字典项：page/get/create/update/delete
- 实现 `dict.PgRepository`（位于 `internal/infrastructure/persistence/dict`），集中 SQL 与事务逻辑。
- `dict.Service` 负责：
  - 输入校验（trim、必填、默认值）
  - 业务语义错误（重复 name/code 映射为 400）
- `DictHandler`：
  - 仅保留 JWT 解析与参数绑定
  - 调用 service 并返回 `OK/Fail`

## 架构决策 ADR
### ADR-004: 字典模块采用 Service + Repository 分层
**上下文:** 字典模块目前在 handler 中直连 SQL，难以复用/测试且耦合较重。
**决策:** 将 SQL/事务下沉到 Repository，将业务校验与语义上收至 Service。
**理由:** 统一架构分层，降低接口层复杂度，便于后续引入 sqlutil 与缓存。
**替代方案:** 仅抽 sqlutil（保留 handler 直连）→ 拒绝原因: 仍然缺乏领域/用例层，耦合问题不解决。
**影响:** 新增若干文件与接口，需要更新组装入口。

## 测试与部署
- **测试:** `go test ./...`（backend-go）
- **部署:** 无额外环境变量变更

