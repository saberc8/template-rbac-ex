# 任务清单: 安全加固与分页优化（A+B+C）

目录: `helloagents/plan/202601120018_security-hardening-abc/`

---

## 1. 系统日志（A）
- [√] 1.1 在 `backend-go/internal/interfaces/http/log_middleware.go` 中增加 header 脱敏与 body 截断策略，验证 why.md#需求-系统日志脱敏与截断-场景-通用接口-body-截断
- [√] 1.2 在 `backend-go/internal/interfaces/http/log_middleware.go` 中对 `/auth/login` 默认跳过 body 采集，验证 why.md#需求-系统日志脱敏与截断-场景-登录接口日志保护

## 2. 启动配置安全（B）
- [√] 2.1 在 `backend-go/cmd/admin/main.go` 移除默认 RSA 私钥与 JWT secret，改为缺失即启动失败，验证 why.md#需求-启动配置安全校验-场景-缺失关键环境变量

## 3. 字典项分页（C）
- [√] 3.1 在 `backend-go/internal/interfaces/http/dict_handler.go` 将字典项分页由内存分页改为 SQL 分页与 COUNT 统计，验证 why.md#需求-字典项分页下推到-sql-场景-字典项分页查询

## 4. 安全检查
- [√] 4.1 执行安全检查（按G9: 输入验证、敏感信息处理、权限控制、EHRB风险规避）

## 5. 文档更新
- [√] 5.1 更新 `helloagents/wiki/arch.md`、`helloagents/wiki/modules/syslog.md`、`helloagents/wiki/modules/cmd.md`、`helloagents/wiki/modules/system.md`
- [√] 5.2 更新 `helloagents/CHANGELOG.md`

## 6. 测试
- [√] 6.1 执行 `go test ./...`（backend-go）
