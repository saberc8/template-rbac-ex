package storage

import "time"

// File 表示文件/目录实体，对应 sys_file 表。
type File struct {
	ID            int64
	Name          string
	OriginalName  string
	Size          *int64
	URL           string
	ParentPath    string
	Path          string
	Sha256        string
	ContentType   string
	Metadata      string
	ThumbnailSize *int64
	ThumbnailName string
	ThumbnailMeta string
	ThumbnailURL  string
	Extension     string
	Type          int16
	StorageID     int64

	CreateUser *int64
	CreateTime time.Time
	UpdateUser *int64
	UpdateTime *time.Time
}

// FileDetail 是文件查询读模型（包含存储名称与创建/修改人昵称）。
type FileDetail struct {
	File
	StorageName      string
	CreateUserString string
	UpdateUserString string
}

