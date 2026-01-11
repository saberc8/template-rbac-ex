# backend-go

## 目的
提供后端 HTTP API、认证与权限校验、系统管理能力，并对接 PostgreSQL/Redis/文件存储等基础设施。

## 模块概述
- **职责:** API 路由与处理、领域与仓储组装、Swagger 文档、跨域与日志中间件
- **状态:** ✅稳定
- **最后更新:** 2026-01-11

## 规范

### 需求: 后端服务启动与对外提供 API
**模块:** backend-go
提供统一端口服务，并暴露 Swagger 文档与静态文件访问。

#### 场景: 启动服务并访问 Swagger
后端启动后可通过 `/swagger/index.html` 打开文档页面。
- 服务端口可通过 `HTTP_PORT` 配置
- 文件静态访问路径为 `/file`（对应 `FILE_STORAGE_DIR`）

## API接口
- Swagger: `GET /swagger/index.html`

## 数据模型
表结构初始化/迁移入口：`backend-go/internal/infrastructure/db/migrate.go`

## 依赖
- PostgreSQL
- Redis
- （可选）MinIO/对象存储

## 变更历史
- 知识库初始化（202601112319） - 结构化整理后端模块文档

