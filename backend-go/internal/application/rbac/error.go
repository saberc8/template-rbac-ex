package rbac

// Error 表示应用层可直接返回给接口层的错误（code/msg 与前端约定一致）。
import "go-backend/internal/core/apperr"

type Error = apperr.Error
