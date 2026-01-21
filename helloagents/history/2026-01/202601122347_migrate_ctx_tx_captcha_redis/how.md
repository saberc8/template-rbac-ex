# 技术设计: DB 迁移 Context/事务化 + 验证码存储统一为 Redis

## 技术方案

### 核心技术
- `database/sql`：`ExecContext` / `QueryRowContext` / `BeginTx`
- Context：由启动入口传入，用于超时/取消控制
- `base64Captcha`：自定义 `Store`（Redis-backed）
- Redis：`go-redis/v9`

### 实现要点

#### 1) 迁移 Context 化与事务化
- 新增：
  - `func AutoMigrateContext(ctx context.Context, database *sql.DB) error`
  - `func AutoMigrate(database *sql.DB) error` 保持不变，但内部调用 `AutoMigrateContext(context.Background(), database)`
- 事务：
  - `tx, err := database.BeginTx(ctx, nil)`，所有 `ensureSys*` 在 `tx` 上执行
  - 成功后 `tx.Commit()`，失败则 `tx.Rollback()`
- 抽象接口：
  - 定义最小能力接口（兼容 `*sql.DB` 与 `*sql.Tx`）：`ExecContext/QueryRowContext`
  - `ensureSys*` 改为 `ensureSysUser(ctx, q)` 形式，避免重复代码

#### 2) 验证码 Redis store
- 新增 `captcha_store_redis.go`：
  - 实现 `base64Captcha.Store`
  - key 规则对齐现有登录逻辑：`CAPTCHA:{uuid}`
  - `Set`：写入 Redis 并设置 TTL
  - `Get/Verify`：按 `clear` 决定是否删除
- 改造 `captcha_handler.go`：
  - 启用验证码时要求 `redis != nil`，否则返回 500
  - `base64Captcha.NewCaptcha(driver, redisStore)` 替代 `DefaultMemStore`
  - 删除手动写入 Redis 的逻辑，避免双写

## 架构决策 ADR

### ADR-007: 自动迁移引入 AutoMigrateContext 并以事务执行
**上下文:** 迁移当前缺少可取消性，且多步骤执行的回滚边界不清晰。
**决策:** 增加 `AutoMigrateContext(ctx, db)`，并在其中开启事务执行所有迁移步骤；`AutoMigrate` 作为兼容包装保留。
**理由:** 可取消、可超时、失败原子回滚，降低半完成状态排查成本。
**替代方案:** 保持无事务逐条执行 → 拒绝原因：一致性与可维护性较差。
**影响:** 迁移执行更一致；如未来出现需 `CONCURRENTLY` 的索引创建，需要拆分到事务外。

### ADR-008: 验证码存储统一为 Redis-backed base64Captcha.Store
**上下文:** 生成验证码使用内存 Store，同时又写 Redis；校验只用 Redis，存在无用写入与一致性风险。
**决策:** 使用 Redis-backed store 直接注入 `base64Captcha.NewCaptcha`，移除内存 Store 与手动 Redis 写入。
**理由:** 单一事实来源（Redis），与登录校验一致，逻辑更简单。
**替代方案:** 保持双写 → 拒绝原因：维护成本高且易引入不一致。
**影响:** Redis 成为验证码功能的唯一依赖；启用验证码时 Redis 不可用将直接失败返回。

## 安全与性能
- **安全:** Redis key 统一前缀，避免键空间混乱；验证码验证后删除避免重复使用。
- **性能:** 迁移在事务内批量执行，减少部分失败状态；验证码存储完全走 Redis，避免内存浪费与双写。

## 测试与部署
- **测试:**
  - Redis store：`Set/Get/Verify` 与 TTL 行为（使用内存 Redis 测试服务）
  - Captcha handler：启用验证码时必须写入 Redis，并返回可用 uuid
  - 运行：`go test ./...`、`go test -race ./...`、`go vet ./...`
- **部署:**
  - 启动入口可在未来为迁移设置超时（如 `context.WithTimeout`），并按环境调整

