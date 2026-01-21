# 变更提案: DB 迁移 Context/事务化 + 验证码存储统一为 Redis

## 需求背景
当前后端存在两类可进一步优化点：

1. **DB 自动迁移（`migrate.go`）缺少 Context 与事务一致性**
   - 多处使用 `db.QueryRow` / `db.Exec`，无法随请求/启动流程进行超时与取消控制；
   - 多条 DDL/seed 分散执行，失败时回滚边界不清晰（部分成功/部分失败会增加排查成本）。

2. **验证码生成使用内存 Store + Redis 双写，存在一致性与可维护性风险**
   - `captcha_handler` 通过 `base64Captcha.DefaultMemStore` 生成验证码，同时手动写入 Redis；
   - 登录校验只使用 Redis，因此内存 Store 属于“无用写入”，且引入潜在的不一致来源。

本变更将：
- 为自动迁移增加 Context 化入口，并将迁移步骤放入事务中执行；
- 将验证码存储统一为 Redis-backed store（与登录校验一致），移除内存 Store 依赖。

## 变更内容
1. 在 `backend-go/internal/infrastructure/db/migrate.go` 中新增 `AutoMigrateContext(ctx, db)`（`AutoMigrate` 保持兼容，内部调用 `context.Background()`）。
2. 将迁移执行改为 `BeginTx(ctx, ...)` + `ExecContext/QueryRowContext`，确保可取消与原子性（同一事务内的 DDL/seed 要么全部成功，要么回滚）。
3. 在 `backend-go/internal/interfaces/http/captcha_handler.go` 中引入 Redis-backed captcha store，并改为 `base64Captcha.NewCaptcha(driver, redisStore)`。
4. 补充单测，覆盖 Redis store 读写与 handler 行为，确保 `go test ./...`（含 `-race`）与 `go vet ./...` 通过。

## 影响范围
- **模块:**
  - `infrastructure/db`（迁移执行）
  - `interfaces/http`（验证码生成）
- **文件:**
  - `backend-go/internal/infrastructure/db/migrate.go`
  - `backend-go/internal/interfaces/http/captcha_handler.go`
  - `backend-go/internal/interfaces/http/captcha_store_redis.go`（新增）
  - `backend-go/internal/interfaces/http/captcha_store_redis_test.go`（新增）
  - `backend-go/internal/interfaces/http/captcha_handler_test.go`（新增或更新）

## 核心场景

### 需求: 迁移可取消/一致性
**模块:** infrastructure/db
启动时执行自动迁移，可被 Context 超时/取消，并以事务保证一致性。

#### 场景: 迁移中断
当 `ctx` 超时或被取消时，迁移应尽快返回错误，并由事务回滚未完成变更。
- 预期结果：`AutoMigrateContext` 返回 `context deadline exceeded`/`context canceled`（或包装错误）；不会留下“半迁移”状态

### 需求: 验证码存储统一为 Redis
**模块:** interfaces/http
验证码生成与校验都使用 Redis（同一 key 前缀与过期策略）。

#### 场景: 生成验证码后可登录校验读取
生成验证码后，Redis 中应存在 `CAPTCHA:{uuid}`，且 TTL 为 2 分钟。
- 预期结果：登录校验可通过 Redis 获取验证码并在成功后删除

## 风险评估
- **风险:** DDL 放入事务可能在极端场景下影响锁粒度与执行时间。
  - **缓解:** 保持迁移仅做幂等创建（`IF NOT EXISTS`）与少量 seed；后续如需大型迁移再拆分为离线脚本或分步骤执行。
- **风险:** Redis 不可用会导致验证码功能不可用。
  - **缓解:** 保持“启用验证码时必须 Redis 可用”的明确失败（当前登录校验也依赖 Redis），并在错误信息中提示。

