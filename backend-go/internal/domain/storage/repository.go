package storage

import "context"

// ErrDefaultStorage 表示“尝试删除默认存储”之类的业务拒绝。
// 用于仓储实现向上层传递可识别的业务原因。
var ErrDefaultStorage = errorString("default storage")

type errorString string

func (e errorString) Error() string { return string(e) }

type StorageListFilter struct {
	Description string
	Type        int64
}

type StorageUpdateStatus struct {
	ID     int64
	Status int16
}

// StorageRepository 定义存储配置的持久化接口。
type StorageRepository interface {
	List(ctx context.Context, f StorageListFilter) ([]StorageDetail, error)
	Get(ctx context.Context, id int64) (*StorageDetail, error)
	GetDefault(ctx context.Context) (*StorageDetail, error)
	ListByIDs(ctx context.Context, ids []int64) ([]StorageDetail, error)
	CodeExists(ctx context.Context, code string, excludeID *int64) (bool, error)
	Create(ctx context.Context, s *Storage) error
	Update(ctx context.Context, s *Storage) error
	Delete(ctx context.Context, ids []int64) error
	UpdateStatus(ctx context.Context, id int64, status int16, userID int64) error
	SetDefault(ctx context.Context, id int64, userID int64) error
	ClearDefault(ctx context.Context) error
}

// FileRepository 定义文件管理的持久化接口（仅 DB 部分，不含文件系统/对象存储操作）。
type FileRepository interface {
	Page(ctx context.Context, q FilePageQuery) ([]FileDetail, int64, error)
	Get(ctx context.Context, id int64) (*FileDetail, error)
	GetByHash(ctx context.Context, sha256 string) (*FileDetail, error)

	DirExists(ctx context.Context, parentPath, name string) (bool, error)
	CreateDir(ctx context.Context, dir *File) error
	CreateFile(ctx context.Context, f *File) error
	UpdateOriginalName(ctx context.Context, id int64, originalName string, userID int64) error

	SumSizeByPathPrefix(ctx context.Context, prefix string) (int64, error)
	Statistics(ctx context.Context) ([]FileStatItem, error)

	DeleteWithChecks(ctx context.Context, ids []int64) ([]FileDeleteTarget, error)
}

type FilePageQuery struct {
	Page         int
	Size         int
	OriginalName string
	Type         int16
	ParentPath   string
}

type FileStatItem struct {
	Type   int16
	Number int64
	Size   int64
}

type FileDeleteTarget struct {
	Path      string
	StorageID int64
}

type DirNotEmptyError struct {
	Name string
}

func (e *DirNotEmptyError) Error() string {
	if e == nil || e.Name == "" {
		return "dir not empty"
	}
	return "dir not empty: " + e.Name
}
