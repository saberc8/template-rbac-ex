# 任务清单: 字典模块分层重构（Handler → Service → Repository）

目录: `helloagents/plan/202601120110_dict-refactor-layering/`

---

## 1. application/dict
- [√] 1.1 新增 `backend-go/internal/application/dict`：定义 Repository 接口与 Service，用例覆盖 dict/dict_item

## 2. persistence/dict
- [√] 2.1 新增 `backend-go/internal/infrastructure/persistence/dict/postgres_repository.go`：实现 SQL 与事务

## 3. HTTP 适配层
- [√] 3.1 重构 `backend-go/internal/interfaces/http/dict_handler.go`：改为调用 service
- [√] 3.2 调整 `backend-go/cmd/admin/main.go`：组装 dict repo + service + handler

## 4. 安全检查
- [√] 4.1 执行安全检查（按G9: 输入验证、敏感信息处理、权限控制）

## 5. 知识库同步
- [√] 5.1 更新 `helloagents/wiki/arch.md` 与 `helloagents/wiki/modules/system.md`（字典模块分层说明）
- [√] 5.2 更新 `helloagents/CHANGELOG.md`

## 6. 测试
- [√] 6.1 执行 `go test ./...`（backend-go）
