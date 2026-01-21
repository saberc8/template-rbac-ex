package system

// Error 表示应用服务对外返回的业务错误。
// Code 对应 HTTP 返回的 code 字段。
type Error struct {
	Code string
	Msg  string
}

