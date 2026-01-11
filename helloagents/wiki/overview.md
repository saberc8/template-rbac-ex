# template-rbac-ex

> 本文件包含项目级别的核心信息。详细的模块文档见 `modules/` 目录。

---

## 1. 项目概述

### 目标与背景
本仓库提供一个 RBAC（角色/菜单/权限）示例工程，包含 Go 后端与 Vue3 管理端，用于演示认证、系统管理与审计日志等常见能力。

### 范围
- **范围内:** 登录/注销、验证码、用户管理、角色与菜单权限、部门/字典/参数/客户端/存储配置、文件管理、系统日志与在线用户
- **范围外:** 生产级多租户、灰度发布、分布式会话与高可用部署（如需以代码实现为准）

### 干系人
- **负责人:** （待补充）

---

## 2. 模块索引

| 模块名称 | 职责 | 状态 | 文档 |
|---------|------|------|------|
| backend-go | Go 后端服务（HTTP API、认证、权限、数据访问） | ✅稳定 | [backend-go](modules/backend-go.md) |
| pc-admin-vue3 | Vue3 管理端（页面、路由与接口调用） | ✅稳定 | [pc-admin-vue3](modules/pc-admin-vue3.md) |
| auth | 登录/注销、验证码、JWT、在线用户 | ✅稳定 | [auth](modules/auth.md) |
| user | 用户体系与用户管理能力 | ✅稳定 | [user](modules/user.md) |
| rbac | 角色/菜单/权限与授权关系 | ✅稳定 | [rbac](modules/rbac.md) |
| system | 部门/字典/参数/客户端/存储/文件等系统管理 | ✅稳定 | [system](modules/system.md) |
| monitor | 系统日志与在线用户监控 | ✅稳定 | [monitor](modules/monitor.md) |

---

## 3. 快速链接
- [技术约定](../project.md)
- [架构设计](arch.md)
- [API 手册](api.md)
- [数据模型](data.md)
- [变更历史](../history/index.md)

