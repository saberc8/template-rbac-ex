# 数据模型

## 概述
后端采用 PostgreSQL 存储核心业务数据。表结构的创建与初始化以 `backend-go/internal/infrastructure/db/migrate.go` 为准。

---

## 数据表（核心）

### sys_user（用户）
**用途:** 系统用户账户与基础信息。  
**关键字段:** `id`、`username`、`password`、`email`、`phone`、`dept_id`、`status`、`create_time`、`update_time`

### sys_role（角色）
**用途:** 角色定义与数据权限范围。  
**关键字段:** `id`、`name`、`code`、`data_scope`、`sort`、`is_system`

### sys_user_role（用户-角色关联）
**用途:** 用户与角色的多对多关系。  
**关键字段:** `id`、`user_id`、`role_id`

### sys_menu（菜单/权限资源）
**用途:** 菜单、目录、按钮等权限资源定义。  
**关键字段:** `id`、`title`、`parent_id`、`type`、`path`、`name`、`component`、`permission`

### sys_role_menu（角色-菜单关联）
**用途:** 角色与菜单/权限资源的多对多关系。  
**关键字段:** `id`、`role_id`、`menu_id`

### sys_dept（部门）
**用途:** 部门树与组织结构。  
**关键字段:** `id`、`name`、`parent_id`、`status`、`sort`

### sys_role_dept（角色-部门关联）
**用途:** 角色数据权限与部门范围的关联关系。  
**关键字段:** `id`、`role_id`、`dept_id`

### sys_dict / sys_dict_item（字典与字典项）
**用途:** 字典分类与明细项。  
**关键字段:** `sys_dict.id`、`code`；`sys_dict_item.id`、`dict_id`、`label`、`value`

### sys_option（系统参数）
**用途:** 站点/系统参数配置。  
**关键字段:** `id`、`name`、`code`、`value`

### sys_client（客户端配置）
**用途:** 客户端接入配置（如密钥、状态等）。  
**关键字段:** `id`、`name`、`client_id`、`client_secret`、`status`

### sys_storage（存储配置）
**用途:** 文件存储配置（本地/对象存储等）。  
**关键字段:** `id`、`name`、`type`、`access_key`、`secret_key`、`status`、`is_default`

### sys_file（文件）
**用途:** 上传文件元信息与归档信息。  
**关键字段:** `id`、`name`、`path`、`size`、`type`、`storage_id`

### sys_log（系统日志）
**用途:** 操作日志、登录日志等审计信息。  
**关键字段:** `id`、`module`、`request_method`、`request_uri`、`ip`、`status`、`create_time`

