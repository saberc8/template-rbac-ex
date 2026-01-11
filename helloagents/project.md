# 项目技术约定

## 技术栈
- **后端:** Go `1.24.0` + Gin `v1.11.0`（Swagger: `swaggo/swag` + `gin-swagger`）
- **前端:** Vue `^3.5.24` + Vite `^7.2.2` + TypeScript `~5.9.3`
- **数据:** PostgreSQL（`github.com/lib/pq`）
- **缓存:** Redis（`github.com/redis/go-redis/v9`）
- **对象存储/上传:** MinIO SDK（`github.com/minio/minio-go/v7`）（具体以存储配置实现为准）

## 开发约定
- **代码组织:**
  - 后端：`backend-go/`（`internal/domain` 领域层、`internal/application` 应用层、`internal/interfaces/http` 接口层）
  - 前端：`pc-admin-vue3/`（Vite + Vue3 管理端）
- **命名约定:** 以目录/包职责命名，API 路径按资源分组（如 `/system/role`、`/auth/login`）

## 配置与环境变量（后端）
以下以 `backend-go/cmd/admin/main.go` 的默认行为为准：
- `HTTP_PORT`: HTTP 端口（默认 `4398`）
- `FILE_STORAGE_DIR`: 上传文件根目录（默认 `./data/file`）
- `AUTH_RSA_PRIVATE_KEY`: RSA 私钥（用于解密前端加密字段；生产环境必须替换）
- `AUTH_JWT_SECRET`: JWT 密钥（生产环境必须替换）
- 数据库与 Redis 连接参数：由 `backend-go/internal/infrastructure/db`、`backend-go/internal/infrastructure/cache` 从环境变量加载（字段以代码为准）

## 错误与日志
- **统一响应结构:** 见 `backend-go/internal/interfaces/http/response.go`
- **系统操作日志:** 通过中间件记录（`backend-go/internal/interfaces/http/log_middleware.go`），落库表 `sys_log`

## 测试与流程
- **前端常用命令:**
  - `pnpm -C pc-admin-vue3 dev`
  - `pnpm -C pc-admin-vue3 build`
  - `pnpm -C pc-admin-vue3 lint`
- **后端运行:**
  - `go run ./backend-go/cmd/admin`

