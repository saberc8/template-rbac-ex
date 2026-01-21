package dict

import (
	"context"
	"time"
)

type DictCreateRequest struct {
	Name        string
	Code        string
	Description string
}

type DictUpdateRequest struct {
	Name        string
	Description string
}

type DictItemCreateRequest struct {
	Label       string
	Value       string
	Color       string
	Sort        int32
	Description string
	Status      int16
	DictID      int64
}

type DictItemUpdateRequest struct {
	Label       string
	Value       string
	Color       string
	Sort        int32
	Description string
	Status      int16
}

type DictItemPageQuery struct {
	DictID      *int64
	Page        int
	Size        int
	Description string
	Status      *int64
}

// Repository 定义字典与字典项的持久化接口。
type Repository interface {
	ListDict(ctx context.Context, description string) ([]Dict, error)
	GetDict(ctx context.Context, id int64) (*Dict, error)
	DictNameExists(ctx context.Context, name string) (bool, error)
	DictCodeExists(ctx context.Context, code string) (bool, error)
	CreateDict(ctx context.Context, id int64, name, code, description string, userID int64, now time.Time) error
	UpdateDict(ctx context.Context, id int64, name, description string, userID int64, now time.Time) error
	DeleteDict(ctx context.Context, ids []int64) error

	PageDictItem(ctx context.Context, q DictItemPageQuery) ([]DictItem, int64, error)
	GetDictItem(ctx context.Context, id int64) (*DictItem, error)
	CreateDictItem(ctx context.Context, id int64, req DictItemCreateRequest, userID int64, now time.Time) error
	UpdateDictItem(ctx context.Context, id int64, req DictItemUpdateRequest, userID int64, now time.Time) error
	DeleteDictItem(ctx context.Context, ids []int64) error

	// ListActiveItemsByCode 返回指定字典 code 下状态为启用(1)的字典项列表。
	ListActiveItemsByCode(ctx context.Context, code string) ([]DictItem, error)
}
