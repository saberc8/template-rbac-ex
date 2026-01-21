package client

import "time"

// Client 表示客户端配置实体，对应 sys_client 表。
type Client struct {
	ID            int64
	ClientID      string
	ClientType    string
	AuthType      []string
	ActiveTimeout int64
	Timeout       int64
	Status        int16

	CreateUser *int64
	CreateTime time.Time
	UpdateUser *int64
	UpdateTime *time.Time
}

// ClientDetail 是客户端查询读模型（包含创建/修改人昵称）。
type ClientDetail struct {
	Client
	CreateUserString string
	UpdateUserString string
}

