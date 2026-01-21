# 任务清单: DB 迁移 Context/事务化 + 验证码存储统一为 Redis

目录: `helloagents/plan/202601122347_migrate_ctx_tx_captcha_redis/`

---

## 1. 迁移模块优化
- [√] 1.1 在 `backend-go/internal/infrastructure/db/migrate.go` 中新增 `AutoMigrateContext(ctx, db)`，并保持 `AutoMigrate` 兼容包装，验证 why.md#需求-迁移可取消一致性-场景-迁移中断
- [√] 1.2 将迁移执行改为事务化：`BeginTx(ctx)` + 全部 `ensureSys*` 在 `Tx` 上运行，统一改为 `ExecContext/QueryRowContext`
- [√] 1.3 为事务化迁移补充单测（覆盖事务回滚路径的结构性断言）

## 2. 验证码存储统一为 Redis
- [√] 2.1 新增 `backend-go/internal/interfaces/http/captcha_store_redis.go`：实现 `base64Captcha.Store`（key 前缀 `CAPTCHA:`，TTL=2min）
- [√] 2.2 改造 `backend-go/internal/interfaces/http/captcha_handler.go`：使用 Redis store 注入 `base64Captcha.NewCaptcha`，移除内存 Store 与手动 Redis 写入
- [√] 2.3 新增测试：
  - `backend-go/internal/interfaces/http/captcha_store_redis_test.go`：覆盖 Set/Get/Verify 与 clear 行为
  - `backend-go/internal/interfaces/http/captcha_handler_test.go`：启用验证码时 redis=nil 返回 500；redis 可用时会写入 `CAPTCHA:{uuid}`

## 3. 质量验证
- [√] 3.1 执行 `go test ./...`
- [√] 3.2 执行 `go test -race ./...`
- [√] 3.3 执行 `go vet ./...`

## 4. 文档与归档
- [√] 4.1 更新 `helloagents/CHANGELOG.md` 记录本次变更
- [√] 4.2 更新 `helloagents/wiki/modules/infrastructure.md` 或相关模块文档（迁移与验证码变更点）
- [√] 4.3 迁移方案包至 `helloagents/history/2026-01/` 并更新 `helloagents/history/index.md`
