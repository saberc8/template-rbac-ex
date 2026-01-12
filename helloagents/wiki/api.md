# API 手册

## 概述
后端基于 Gin 提供 JSON API，统一返回结构：
`{ code, data, msg, success, timestamp }`。

## 认证方式
- Header: `Authorization: Bearer <token>`
- 令牌由 `POST /auth/login` 颁发。

---

## 接口列表（按模块）

### 认证
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/user/info`
- `GET /auth/user/route`

### 系统管理（节选）
- `GET /system/menu/tree`
- `GET /system/role/list`
- `GET /system/user`（分页）
- `GET /system/dict/list`
- `GET /system/dict/item`（分页）

### 监控
- `GET /monitor/online`
- `GET /monitor/log`

### 其他
- 静态文件：`GET /file/*`
- Swagger：`GET /swagger/*`

