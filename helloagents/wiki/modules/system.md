# 系统管理

## 目的
提供系统管理相关接口（用户/部门/角色/菜单/字典/配置/客户端/文件/存储等）。

## 模块概述
- **职责:** 各系统管理资源的 CRUD 与列表查询。
- **状态:** 🚧开发中
- **最后更新:** 2026-01-12

## 规范
### 需求: 列表查询必须数据库分页
**模块:** 系统管理
涉及列表与分页的接口，必须在 SQL 层完成过滤与分页，返回正确的 total。

#### 场景: 字典项分页查询
- 请求带 `page/size` 时，返回对应页数据
- total 为满足过滤条件的总行数

## API接口（节选）
### GET /system/dict/item
**描述:** 字典项分页查询（SQL 层过滤与分页）
**输入:** `dictId`（可选）、`page/size`、`description`（可选模糊匹配）、`status`（可选）
**输出:** `PageResult<DictItemResp>`

## 内部实现（字典模块）
- HTTP 适配层：`backend-go/internal/interfaces/http/dict_handler.go`
- 应用层：`backend-go/internal/application/dict`
- 持久化层：`backend-go/internal/infrastructure/persistence/dict`

## 内部实现（鉴权）
- 统一鉴权中间件：`backend-go/internal/interfaces/http/auth_middleware.go`
- 需要登录的写接口通过 `RequireUserID` 获取 `userID`（避免重复解析 JWT）

## 变更历史
- 202601120018_security-hardening-abc - 字典项分页下推到 SQL
- 202601120110_dict-refactor-layering - 字典模块分层重构（Handler → Service → Repository）
