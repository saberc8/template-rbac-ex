# 变更提案: 安全加固与分页优化（A+B+C）

## 需求背景
当前后端具备基本分层结构，但存在三类高优先级问题：
1. 启动配置存在“默认密钥/私钥”风险，容易被误用进入生产环境。
2. 系统日志会采集并落库请求/响应 body，可能写入 token、密码、验证码等敏感信息。
3. 字典项分页接口目前采用内存分页（全量查询后切片），在数据量上升时存在性能与内存风险，且过滤与 total 口径不够稳定。

## 变更内容
1. 系统日志默认脱敏、截断、并对敏感路径跳过 body 记录。
2. 禁止内置默认密钥，启动时强制校验关键环境变量。
3. 字典项列表分页下推到 SQL 层（过滤/分页/total 统一由 DB 计算）。

## 影响范围
- **模块:**
  - 系统日志（HTTP 中间件）
  - 后端启动入口（配置校验）
  - 系统管理-字典（分页查询）
- **文件:**
  - `backend-go/cmd/admin/main.go`
  - `backend-go/internal/interfaces/http/log_middleware.go`
  - `backend-go/internal/interfaces/http/dict_handler.go`
- **API:**
  - `POST /auth/login`（日志采集策略变化，不影响响应）
  - `GET /system/dict/item`（分页行为更严格、性能更好，返回结构不变）
- **数据:**
  - `sys_log` 写入内容变化（更安全）

## 核心场景

### 需求: 系统日志脱敏与截断
**模块:** 系统日志
避免敏感信息/超大 body 写入 `sys_log`，同时保留必要的审计字段。

#### 场景: 登录接口日志保护
请求 `POST /auth/login` 时：
- 不记录请求/响应 body
- 请求/响应 header 中的 `Authorization` 脱敏

#### 场景: 通用接口 body 截断
对其它接口：
- 请求/响应 body 超过上限时截断并标识被截断

### 需求: 启动配置安全校验
**模块:** 后端入口与组装
防止默认密钥进入真实环境运行。

#### 场景: 缺失关键环境变量
缺少 `AUTH_RSA_PRIVATE_KEY` 或 `AUTH_JWT_SECRET`：
- 启动失败并给出明确错误信息

### 需求: 字典项分页下推到 SQL
**模块:** 系统管理
避免全量查询导致性能问题，并保证 total 语义正确。

#### 场景: 字典项分页查询
请求 `GET /system/dict/item?page=1&size=10&description=xx&status=1`：
- 只返回指定页数据
- total 为满足过滤条件的总数

## 风险评估
- **风险:** 日志策略变化可能影响排障信息完整度。
- **缓解:** 保留 method/path/status/time/userId 等核心字段；对非敏感路径仍可记录截断后的 body。

