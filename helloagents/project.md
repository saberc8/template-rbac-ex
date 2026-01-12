# 项目技术约定

## 技术栈
- **后端:** Go + Gin
- **数据库:** PostgreSQL（通过 `database/sql` + `lib/pq`）
- **缓存:** Redis（验证码等）
- **接口文档:** Swagger（`/swagger/index.html`）
- **前端:** Vue3（`pc-admin-vue3/`）

## 目录与分层约定（后端）
- `backend-go/cmd/*`: 程序入口与组装（依赖注入、路由注册、配置加载）。
- `backend-go/internal/domain`: 领域实体与仓储接口（业务模型、规则）。
- `backend-go/internal/application`: 用例/应用服务（编排领域与基础设施）。
- `backend-go/internal/interfaces/http`: HTTP 适配层（参数绑定、鉴权、响应包装）。
- `backend-go/internal/infrastructure`: 基础设施实现（DB/Redis/Security/Repository）。

## 配置与密钥
- **禁止**在代码中内置默认密钥（JWT secret、RSA 私钥等）。
- 启动时必须校验关键环境变量（缺失即失败退出）。
- 约定用环境变量配置：`DB_*`、`REDIS_*`、`AUTH_*`、`HTTP_PORT` 等。

## 错误与日志
- HTTP 返回统一包装结构（`code/msg/success/timestamp/data`）。
- 系统操作日志（`sys_log`）不得记录敏感信息：
  - `Authorization`、密码、验证码、token 等必须脱敏/跳过；
  - 请求/响应体需设置最大长度截断，避免超大 body 影响存储与性能。

## 测试与流程
- 最低要求：关键改动完成后执行 `go test ./...`。
- 对安全相关变更需做回归点验：登录、主要管理接口、日志落库。

