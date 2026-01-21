package rbac

// Error 表示应用层可直接返回给接口层的错误（code/msg 与前端约定一致）。
type Error struct {
	Code string
	Msg  string
}

