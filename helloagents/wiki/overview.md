# voc-go-backend（Avalon 管理后台）

> 本文件包含项目级别的核心信息。详细的模块文档见 `modules/` 目录。

---

## 1. 项目概述

### 目标与背景
提供一套管理后台的后端接口与基础管理能力（认证、RBAC、系统管理、审计日志等），并与 `pc-admin-vue3/` 前端对接。

### 范围
- **范围内:** 认证登录、用户/角色/菜单/部门/字典/配置/文件/存储/客户端、系统日志与在线用户。
- **范围外:** 多租户、灰度发布、生产级别分布式 ID、全链路追踪等（当前未实现）。

---

## 2. 模块索引

| 模块名称 | 职责 | 状态 | 文档 |
|---------|------|------|------|
| 后端整体（backend-go） | 后端服务整体能力与入口说明 | ✅稳定 | [backend-go](modules/backend-go.md) |
| 后端入口与组装 | 启动、依赖注入、路由注册、Swagger | 🚧开发中 | [cmd](modules/cmd.md) |
| 认证与用户信息 | 登录、JWT、用户信息与路由构建 | 🚧开发中 | [auth](modules/auth.md) |
| RBAC | 角色、菜单、权限查询（仓储接口+Pg实现） | 🚧开发中 | [rbac](modules/rbac.md) |
| 系统管理 | 字典/用户/部门/配置/客户端等管理接口 | 🚧开发中 | [system](modules/system.md) |
| 用户管理（user） | 用户 CRUD、密码、角色分配、导入导出 | ✅稳定 | [user](modules/user.md) |
| 系统日志 | 操作日志采集与落库（`sys_log`） | 🚧开发中 | [syslog](modules/syslog.md) |
| 监控（monitor） | 在线用户与系统日志查询/导出 | ✅稳定 | [monitor](modules/monitor.md) |
| 基础设施 | DB/Redis/Security/ID/迁移 | 🚧开发中 | [infrastructure](modules/infrastructure.md) |
| 管理后台前端 | Vue3 管理后台 | 🚧开发中 | [pc-admin-vue3](modules/pc-admin-vue3.md) |

---

## 3. 快速链接
- [技术约定](../project.md)
- [架构设计](arch.md)
- [API 手册](api.md)
- [数据模型](data.md)
- [变更历史](../history/index.md)
