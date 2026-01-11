# system

## 目的
提供系统管理类能力，包括部门、字典、参数、客户端配置、存储配置与文件管理等。

## 模块概述
- **职责:** 系统配置维护与通用资源管理
- **状态:** ✅稳定
- **最后更新:** 2026-01-11

## 规范

### 需求: 管理部门树
**模块:** system
维护组织部门树，供用户归属与数据权限等功能使用（以实现为准）。

#### 场景: 查询部门树
调用 `GET /system/dept/tree`。
- 返回树结构数据

### 需求: 管理字典与字典项
**模块:** system
提供字典分类与明细项维护，供前端下拉选项等使用。

#### 场景: 清理指定字典缓存
调用 `DELETE /system/dict/cache/:code`。
- 清理后应重新从数据库加载（以实现为准）

### 需求: 管理存储配置与文件
**模块:** system
维护存储配置，提供文件上传与文件元信息管理。

#### 场景: 上传文件
调用 `POST /system/file/upload`。
- 保存文件并记录元信息（表 `sys_file`）

## API接口
- 部门：`/system/dept*`
- 字典：`/system/dict*`、`/system/dict/item*`
- 参数：`/system/option*`
- 客户端：`/system/client*`
- 存储：`/system/storage*`
- 文件：`/system/file*`

## 数据模型
- `sys_dept`
- `sys_dict` / `sys_dict_item`
- `sys_option`
- `sys_client`
- `sys_storage`
- `sys_file`

## 依赖
- PostgreSQL
- （可选）MinIO/对象存储

## 变更历史
- 知识库初始化（202601112319） - 系统管理模块文档初始化

