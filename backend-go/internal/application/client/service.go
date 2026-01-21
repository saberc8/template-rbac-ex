package client

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	domainclient "go-backend/internal/domain/client"
)

// Service 提供 client 子域的用例编排（客户端配置）。
type Service struct {
	repo   domainclient.Repository
	nextID func() int64
	now    func() time.Time
}

func NewService(repo domainclient.Repository, nextID func() int64) *Service {
	return &Service{repo: repo, nextID: nextID, now: time.Now}
}

func (s *Service) Page(ctx context.Context, q domainclient.PageQuery) (domainclient.PageResult, *Error) {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Size <= 0 {
		q.Size = 10
	}
	q.ClientType = strings.TrimSpace(q.ClientType)
	for i := range q.AuthType {
		q.AuthType[i] = strings.TrimSpace(q.AuthType[i])
	}
	res, err := s.repo.Page(ctx, q)
	if err != nil {
		return domainclient.PageResult{}, &Error{Code: "500", Msg: "查询客户端失败"}
	}
	return res, nil
}

func (s *Service) Get(ctx context.Context, id int64) (*domainclient.ClientDetail, *Error) {
	if id <= 0 {
		return nil, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	item, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询客户端失败"}
	}
	if item == nil {
		return nil, &Error{Code: "404", Msg: "客户端不存在"}
	}
	return item, nil
}

func (s *Service) Create(ctx context.Context, userID int64, req CreateRequest) (int64, *Error) {
	req.ClientType = strings.TrimSpace(req.ClientType)
	req.AuthType = normalizeNonEmptyUnique(req.AuthType)
	if req.ClientType == "" || len(req.AuthType) == 0 {
		return 0, &Error{Code: "400", Msg: "客户端类型和认证类型不能为空"}
	}
	if req.ActiveTimeout == 0 {
		req.ActiveTimeout = 1800
	}
	if req.Timeout == 0 {
		req.Timeout = 86400
	}
	if req.Status == 0 {
		req.Status = 1
	}

	// client_id 使用随机雪花 ID 的 hex 形式，保证唯一且长度适中。
	clientID := fmt.Sprintf("%x", s.next())
	if _, err := json.Marshal(req.AuthType); err != nil {
		return 0, &Error{Code: "500", Msg: "保存客户端失败"}
	}

	now := s.now()
	idVal := s.next()
	if idVal == 0 {
		return 0, &Error{Code: "500", Msg: "生成客户端 ID 失败"}
	}
	item := &domainclient.Client{
		ID:            idVal,
		ClientID:      clientID,
		ClientType:    req.ClientType,
		AuthType:      req.AuthType,
		ActiveTimeout: req.ActiveTimeout,
		Timeout:       req.Timeout,
		Status:        req.Status,
		CreateUser:    &userID,
		CreateTime:    now,
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return 0, &Error{Code: "500", Msg: "新增客户端失败"}
	}
	return idVal, nil
}

func (s *Service) Update(ctx context.Context, userID int64, id int64, req UpdateRequest) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	req.ClientType = strings.TrimSpace(req.ClientType)
	req.AuthType = normalizeNonEmptyUnique(req.AuthType)
	if req.ClientType == "" || len(req.AuthType) == 0 {
		return &Error{Code: "400", Msg: "客户端类型和认证类型不能为空"}
	}
	if req.Status == 0 {
		req.Status = 1
	}
	if _, err := json.Marshal(req.AuthType); err != nil {
		return &Error{Code: "500", Msg: "保存客户端失败"}
	}

	now := s.now()
	item := &domainclient.Client{
		ID:            id,
		ClientType:    req.ClientType,
		AuthType:      req.AuthType,
		ActiveTimeout: req.ActiveTimeout,
		Timeout:       req.Timeout,
		Status:        req.Status,
		UpdateUser:    &userID,
		UpdateTime:    &now,
	}
	if err := s.repo.Update(ctx, item); err != nil {
		return &Error{Code: "500", Msg: "修改客户端失败"}
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, ids []int64) *Error {
	if len(ids) == 0 {
		return &Error{Code: "400", Msg: "ID 列表不能为空"}
	}
	if err := s.repo.Delete(ctx, ids); err != nil {
		return &Error{Code: "500", Msg: "删除客户端失败"}
	}
	return nil
}

func (s *Service) next() int64 {
	if s == nil || s.nextID == nil {
		return 0
	}
	return s.nextID()
}

func normalizeNonEmptyUnique(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
