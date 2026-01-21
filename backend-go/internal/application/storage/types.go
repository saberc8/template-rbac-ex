package storage

// StorageCreateRequest 表示新增存储配置请求。
type StorageCreateRequest struct {
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
	IsDefault   *bool
	Sort        int32
	Status      int16
}

// StorageUpdateRequest 表示更新存储配置请求。
type StorageUpdateRequest struct {
	Name        string
	Code        string
	Type        int16
	AccessKey   string
	SecretKey   *string
	Endpoint    string
	Region      string
	BucketName  string
	Domain      string
	Description string
	IsDefault   *bool
	Sort        int32
	Status      int16
}
