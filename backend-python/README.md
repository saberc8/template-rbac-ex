# backend-python（FastAPI 后端）

目标：提供与 `backend-go` 行为一致的后端实现，使 `pc-admin-vue3` / `pc-admin-react` 可无感切换后端。

## 1. 安装依赖

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## 2. 配置环境变量

```bash
cp .env.example .env
```

必填：`AUTH_JWT_SECRET`

可选：`ADMIN_FRONTEND_TYPE`
- `vue3`（默认）：对齐 `backend-go` 的接口集合与统一响应包装
- `react`：启用 slash-admin(React) 兼容接口（如 `/menu`、`/user/tokenExpired`），登录统一走 `/auth/login`

## 3. 初始化/迁移数据库（推荐显式执行）

```bash
python -m app.cmd.migrate
```

## 4. 启动服务

```bash
uvicorn app.main:app --host 0.0.0.0 --port ${HTTP_PORT:-14396} --reload
```

建议端口：
- Go 后端：`14398`（默认）
- React 前端：`3001`（默认，可自行调整端口）
- Vue3 前端：`14399`（仓库默认）
- Python 后端：`14396`（避免与前端端口冲突）
```
