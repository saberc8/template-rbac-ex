package syslog

// Error 表示应用服务对外返回的业务错误。
type Error struct {
	Code string
	Msg  string
}

