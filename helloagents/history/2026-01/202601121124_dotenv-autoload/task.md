# 任务清单: 开发环境自动加载 .env（godotenv）

目录: `helloagents/plan/202601121124_dotenv-autoload/`

---

## 1. 代码改动
- [√] 1.1 在 `backend-go/cmd/admin/main.go` 中引入 `godotenv`，启动时自动加载 `backend-go/.env`（开发环境启用，生产环境可禁用）

## 2. 依赖与示例配置
- [√] 2.1 在 `backend-go/go.mod`/`backend-go/go.sum` 引入 `github.com/joho/godotenv`
- [√] 2.2 更新 `backend-go/.env.example` 与 `backend-go/README.md` 说明加载规则与 `APP_ENV` 用法

## 3. 知识库同步
- [√] 3.1 更新 `helloagents/wiki/modules/cmd.md` 与 `helloagents/CHANGELOG.md`

## 4. 测试
- [√] 4.1 执行 `go test ./...`（backend-go）
