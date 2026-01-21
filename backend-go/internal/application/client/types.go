package client

// CreateRequest 表示新增客户端配置请求。
type CreateRequest struct {
	ClientType    string
	AuthType      []string
	ActiveTimeout int64
	Timeout       int64
	Status        int16
}

// UpdateRequest 表示更新客户端配置请求。
type UpdateRequest = CreateRequest

