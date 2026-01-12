# 变更提案: 字典模块分层重构（Handler → Service → Repository）

## 需求背景
当前 `backend-go/internal/interfaces/http/dict_handler.go` 同时承担了：
- HTTP 参数绑定与鉴权
- 业务校验与错误码映射
- SQL 拼装、事务管理与数据扫描

这会导致：
- 业务与数据访问强耦合，难以复用与测试；
- 其它模块难以遵循统一分层规范；
- 后续引入统一 sqlutil、审计、缓存等横切能力时改动面扩大。

## 变更内容
1. 引入 `internal/application/dict`：封装字典/字典项用例逻辑（校验、错误语义）。
2. 引入 `internal/infrastructure/persistence/dict`：集中管理 SQL 与事务，提供 Repository 实现。
3. `dict_handler.go` 退化为薄适配层：仅做参数绑定、鉴权、调用 service、返回响应。

## 影响范围
- **模块:**
  - 系统管理（字典）
  - 基础设施（Pg Repository）
- **文件（预期新增/修改）:**
  - `backend-go/internal/application/dict/*`
  - `backend-go/internal/infrastructure/persistence/dict/postgres_repository.go`
  - `backend-go/internal/interfaces/http/dict_handler.go`
  - `backend-go/cmd/admin/main.go`（组装依赖）

## 核心场景

### 需求: 字典接口维持兼容
**模块:** 系统管理
不改变现有 API 路径与响应结构，仅调整内部实现分层。

#### 场景: 字典项分页查询
调用 `GET /system/dict/item?page=1&size=10`：
- 返回结构保持不变
- 过滤与分页仍在 SQL 层执行

### 需求: 业务校验语义一致
**模块:** 系统管理
字典创建的“名称/编码已存在”等业务错误码与文案保持一致。

#### 场景: 新增字典名称重复
创建字典时名称已存在：
- 返回 `code=400`
- msg 为“新增失败，[name] 已存在”（保持现有语义）

## 风险评估
- **风险:** 分层重构引入编译错误或行为差异。
- **缓解:** 保持 SQL 与返回结构一致；通过 `go test ./...` 与手工回归字典接口验证。

