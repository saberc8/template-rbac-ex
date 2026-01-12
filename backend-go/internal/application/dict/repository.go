package dict

import (
	"context"
	"time"
)

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
}
