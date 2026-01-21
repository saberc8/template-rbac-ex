package syslog

import (
	"context"
	"strings"

	domainsyslog "go-backend/internal/domain/syslog"
)

// Service 提供 syslog 子域的用例编排（日志查询）。
type Service struct {
	qrepo domainsyslog.QueryRepository
}

func NewService(qrepo domainsyslog.QueryRepository) *Service {
	return &Service{qrepo: qrepo}
}

func (s *Service) Page(ctx context.Context, f domainsyslog.QueryFilter) ([]domainsyslog.ListItem, int64, *Error) {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.Size <= 0 {
		f.Size = 10
	}
	f.Description = strings.TrimSpace(f.Description)
	f.Module = strings.TrimSpace(f.Module)
	f.IP = strings.TrimSpace(f.IP)
	f.CreateUser = strings.TrimSpace(f.CreateUser)

	list, total, err := s.qrepo.Page(ctx, f)
	if err != nil {
		return nil, 0, &Error{Code: "500", Msg: "查询日志失败"}
	}
	return list, total, nil
}

func (s *Service) Get(ctx context.Context, id int64) (*domainsyslog.Detail, *Error) {
	if id <= 0 {
		return nil, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	item, err := s.qrepo.Get(ctx, id)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询日志失败"}
	}
	if item == nil {
		return nil, &Error{Code: "404", Msg: "日志不存在"}
	}
	return item, nil
}

func (s *Service) ListForExport(ctx context.Context, f domainsyslog.QueryFilter) ([]domainsyslog.ListItem, *Error) {
	f.Description = strings.TrimSpace(f.Description)
	f.Module = strings.TrimSpace(f.Module)
	f.IP = strings.TrimSpace(f.IP)
	f.CreateUser = strings.TrimSpace(f.CreateUser)

	list, err := s.qrepo.ListForExport(ctx, f)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "导出日志失败"}
	}
	return list, nil
}
