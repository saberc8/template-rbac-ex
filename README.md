# Python + React 启动说明（本仓库）

本仓库同时包含多套前后端实现；本文档仅覆盖 **`backend-python`（FastAPI）** + **`pc-admin-react`（React/Vite）** 的本地启动。

## 目录结构（与本文相关）

- `backend-python/`：Python 后端（FastAPI + SQLAlchemy + Alembic）
- `pc-admin-react/`：React 管理端（Vite dev server，开发期通过代理访问后端）

## 端口约定（默认值）

- Python 后端：`14396`（`backend-python/.env` 的 `HTTP_PORT`）
- React 前端（dev）：`14397`（见 `pc-admin-react/vite.config.ts`）

## 依赖与环境

- Python：建议 `>=3.11`
- Node.js：`20.*`（`pc-admin-react/package.json#engines`）
- pnpm：项目声明为 `pnpm@10.x`
- 数据库/缓存：默认使用 PostgreSQL + Redis（可在 `backend-python/.env` 切换为 MySQL）

## 一键式本地启动（开发模式）

### 1) 启动数据库与 Redis

你需要先准备可用的 PostgreSQL 与 Redis，并确保 `backend-python/.env` 中的连接信息正确。

`backend-python/.env.example` 默认值：
- PostgreSQL：`127.0.0.1:5432`，库名 `ex_admin_v1`，用户 `postgres`，密码 `123456`
- Redis：`127.0.0.1:6379`

### 2) 启动后端（FastAPI）

```bash
cd backend-python

python3 -m venv .venv
source .venv/bin/activate

python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt

cp .env.example .env
```

编辑 `backend-python/.env`（至少确认以下两项）：
- `AUTH_JWT_SECRET`：必填（生产环境请使用强随机值）
- `ADMIN_FRONTEND_TYPE=react`：让后端启用 React 兼容接口（例如 `/menu` 等）

初始化/迁移数据库（推荐显式执行）：

```bash
python -m app.cmd.migrate --seed all
```

启动服务：

```bash
uvicorn app.main:app --host 0.0.0.0 --port ${HTTP_PORT:-14396} --reload
```

### 3) 启动前端（React）

```bash
cd pc-admin-react

pnpm install
cp .env.example .env
pnpm dev
```

默认会打开浏览器：`http://localhost:14397`

开发期接口代理说明：
- 前端请求以 `VITE_APP_API_BASE_URL=/api` 为基准
- Vite dev server 会把 `/api/*` 代理到 `VITE_APP_API_PROXY_TARGET`（默认 `http://localhost:14396`），并移除 `/api` 前缀

## 常见问题（Troubleshooting）

### 1) 前端能打开但接口全 404/跨域

优先检查：
- 后端是否已启动在 `14396`
- `pc-admin-react/.env` 的 `VITE_APP_API_PROXY_TARGET` 是否指向正确后端地址
- `backend-python/.env` 的 `ADMIN_FRONTEND_TYPE` 是否为 `react`

### 2) 需要同步 React 动态菜单（/menu）

在 `backend-python/` 下执行：

```bash
python -m app.cmd.migrate --seed react-menu --force
```

### 3) MySQL 登录报 cryptography 相关错误

若遇到：
`RuntimeError: 'cryptography' package is required for sha256_password or caching_sha2_password auth methods`

在虚拟环境中重新安装依赖（`requirements.txt` 已包含 `cryptography`）：

```bash
python -m pip install -r requirements.txt
```

