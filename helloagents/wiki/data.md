# 数据模型

## 概述
后端启动时会执行自动迁移（`backend-go/internal/infrastructure/db/migrate.go`），以确保核心表存在。

---

## 关键数据表（节选）

### sys_user
系统用户表。

### sys_role / sys_user_role
角色与用户-角色关联。

### sys_menu / sys_role_menu
菜单与角色-菜单关联，支持权限码（permission）。

### sys_dict / sys_dict_item
字典与字典项。

### sys_log
系统操作日志（请求/响应采集），需严格避免写入敏感信息。

