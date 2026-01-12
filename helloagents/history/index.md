# 变更历史索引

本文件记录所有已完成变更的索引，便于追溯和查询。

---

## 索引

| 时间戳 | 功能名称 | 类型 | 状态 | 方案包路径 |
|--------|----------|------|------|------------|
| 202601120018 | security-hardening-abc | 修复/优化 | ✅已完成 | [202601120018_security-hardening-abc](2026-01/202601120018_security-hardening-abc/) |
| 202601120110 | dict-refactor-layering | 重构 | ✅已完成 | [202601120110_dict-refactor-layering](2026-01/202601120110_dict-refactor-layering/) |
| 202601120135 | auth-middleware-context | 重构 | ✅已完成 | [202601120135_auth-middleware-context](2026-01/202601120135_auth-middleware-context/) |
| 202601121124 | dotenv-autoload | 优化 | ✅已完成 | [202601121124_dotenv-autoload](2026-01/202601121124_dotenv-autoload/) |
| 202601122139 | captcha-clear | 优化 | ✅已完成 | [202601122139_captcha-clear](2026-01/202601122139_captcha-clear/) |
| 202601122248 | go1255-optimize-clienthandler | 优化 | ✅已完成 | [202601122248_go1255_optimize_clienthandler](2026-01/202601122248_go1255_optimize_clienthandler/) |

---

## 按月归档

### 2026-01

- [202601120018_security-hardening-abc](2026-01/202601120018_security-hardening-abc/) - 系统日志脱敏与截断、启动密钥校验、字典项 SQL 分页
- [202601120110_dict-refactor-layering](2026-01/202601120110_dict-refactor-layering/) - 字典模块分层重构（Handler → Service → Repository）
- [202601120135_auth-middleware-context](2026-01/202601120135_auth-middleware-context/) - 统一鉴权中间件与 userID Context 注入
- [202601121124_dotenv-autoload](2026-01/202601121124_dotenv-autoload/) - 开发环境自动加载 .env（godotenv）
- [202601122139_captcha-clear](2026-01/202601122139_captcha-clear/) - 登录验证码图片可读性优化（后端实现，接口不变）
- [202601122248_go1255_optimize_clienthandler](2026-01/202601122248_go1255_optimize_clienthandler/) - Go 1.25.5 升级与 /system/client 列表参数/筛选优化
