package storage

import (
	"context"
	"mime/multipart"

	domainstorage "go-backend/internal/domain/storage"
)

// FileContentStore 负责文件内容的物理存储（本地/对象存储等）。
// application 层只依赖该端口接口，不直接依赖 MinIO 或文件系统实现。
type FileContentStore interface {
	Save(ctx context.Context, header *multipart.FileHeader, storage *domainstorage.StorageDetail, parentPath, storedName string) (SaveResult, error)
	Delete(ctx context.Context, storage *domainstorage.StorageDetail, fullPath string) error
}

type SaveResult struct {
	FullPath    string
	SHA256      string
	Size        int64
	ContentType string
}
