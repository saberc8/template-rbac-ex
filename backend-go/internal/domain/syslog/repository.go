package syslog

import "context"

// Repository 定义系统日志持久化接口，便于后续扩展（例如异步落库、分库分表）。
type Repository interface {
	// Save 保存一条系统日志记录。
	Save(ctx context.Context, rec *Record) error
}

// QueryRepository 定义系统日志查询接口（列表/详情/导出）。
type QueryRepository interface {
	Page(ctx context.Context, f QueryFilter) ([]ListItem, int64, error)
	Get(ctx context.Context, id int64) (*Detail, error)
	ListForExport(ctx context.Context, f QueryFilter) ([]ListItem, error)
}
