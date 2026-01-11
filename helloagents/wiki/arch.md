# 架构设计

## 总体架构
```mermaid
flowchart TD
    UI[pc-admin-vue3 管理端] -->|HTTP + JSON| API[backend-go Gin API]
    API --> PG[(PostgreSQL)]
    API --> R[(Redis)]
    API --> FS[(本地文件目录 ./data/file)]
    API -.可选.-> OSS[(MinIO / 对象存储)]
```

## 技术栈
- **后端:** Go + Gin + Swaggo（Swagger UI）
- **前端:** Vue3 + Vite + TypeScript + Pinia + Vue Router
- **数据:** PostgreSQL
- **缓存:** Redis

## 核心流程
```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 管理端
    participant API as 后端
    participant PG as PostgreSQL
    participant R as Redis

    U->>UI: 输入账号/密码/验证码
    UI->>API: POST /auth/login
    API->>PG: 校验用户与角色
    API->>R: 校验/消费验证码（如开启）
    API-->>UI: 返回 JWT
    UI->>API: 带 Authorization 调用 /auth/user/info /auth/user/route
    API->>PG: 查询用户权限与菜单
    API-->>UI: 返回用户信息与路由
```

## 重大架构决策
当前阶段未记录独立 ADR；如后续引入关键架构选型（如多租户、分布式会话、权限缓存策略），应在变更方案包 `how.md` 中补充并在此处建立索引。

