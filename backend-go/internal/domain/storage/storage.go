package storage

import "time"

// Storage 表示存储配置实体，对应 sys_storage 表。
type Storage struct {
	ID          int64
	Name        string
	Code        string
	Type        int16
	AccessKey   string
	SecretKey   string
	Endpoint    string
	Region      string
	BucketName  string
	Domain      string
	Description string
	IsDefault   bool
	Sort        int32
	Status      int16

	CreateUser *int64
	CreateTime time.Time
	UpdateUser *int64
	UpdateTime *time.Time
}

// StorageDetail 是存储配置查询读模型（包含创建/修改人昵称）。
type StorageDetail struct {
	Storage
	CreateUserString string
	UpdateUserString string
}

