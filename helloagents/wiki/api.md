# API 手册

## 概述
后端服务提供以 `/auth/*`、`/system/*`、`/monitor/*`、`/common/*` 为主的 HTTP JSON API，并通过 Swagger UI 暴露可交互的接口文档。

- Swagger UI: `GET /swagger/index.html`

## 认证方式
- **Bearer Token:** 通过请求头 `Authorization: Bearer <token>` 传递
- **定义来源:** `backend-go/cmd/admin/main.go`（Swagger 注解 `BearerAuth`）

---

## 接口列表（按路由前缀）

### 认证与用户（auth）
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/user/info`
- `GET /auth/user/route`

### 验证码（captcha）
- `GET /captcha/image`

### 公共能力（common）
- `GET /common/dict/:code`
- `GET /common/dict/option/site`
- `GET /common/dict/role`
- `GET /common/dict/user`
- `GET /common/tree/dept`
- `GET /common/tree/menu`
- `POST /common/file`

### 系统管理（system）
- 用户：`GET /system/user/list`、`PATCH /system/user/:id/password`、`PATCH /system/user/:id/role`、导入导出等
- 角色：`GET /system/role/list`、`PUT /system/role/:id/permission`、`/system/role/:id/user` 关系维护
- 菜单：`GET /system/menu/tree` 等
- 部门：`GET /system/dept/tree` 等
- 字典：`/system/dict/*`、`/system/dict/item*`、`/system/dict/cache/*`
- 参数：`GET /system/option`、`PATCH /system/option/value`
- 客户端：`/system/client*`
- 文件：`/system/file*`、`POST /system/file/upload`、`POST /system/file/dir`
- 存储：`/system/storage*`、默认/状态管理
- 日志：`/system/log*`（查询/导出）

### 监控（monitor）
- 在线用户：`GET /monitor/online`、`DELETE /monitor/online/:token`

> 详细字段与示例以 Swagger 文档与处理器实现为准：`backend-go/internal/interfaces/http/*_handler.go`。

