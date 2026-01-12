package dict

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type Service struct {
	repo   Repository
	nextID func() int64
}

func NewService(repo Repository, nextID func() int64) *Service {
	return &Service{repo: repo, nextID: nextID}
}

func (s *Service) ListDict(ctx context.Context, description string) ([]Dict, *Error) {
	list, err := s.repo.ListDict(ctx, strings.TrimSpace(description))
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询字典失败"}
	}
	return list, nil
}

func (s *Service) GetDict(ctx context.Context, id int64) (*Dict, *Error) {
	if id <= 0 {
		return nil, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	d, err := s.repo.GetDict(ctx, id)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询字典失败"}
	}
	if d == nil {
		return nil, &Error{Code: "404", Msg: "字典不存在"}
	}
	return d, nil
}

func (s *Service) CreateDict(ctx context.Context, userID int64, req DictCreateRequest) (int64, *Error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Code = strings.TrimSpace(req.Code)
	req.Description = strings.TrimSpace(req.Description)
	if req.Name == "" || req.Code == "" {
		return 0, &Error{Code: "400", Msg: "名称和编码不能为空"}
	}

	exists, err := s.repo.DictNameExists(ctx, req.Name)
	if err != nil {
		return 0, &Error{Code: "500", Msg: "新增字典失败"}
	}
	if exists {
		return 0, &Error{Code: "400", Msg: fmt.Sprintf("新增失败，[%s] 已存在", req.Name)}
	}
	exists, err = s.repo.DictCodeExists(ctx, req.Code)
	if err != nil {
		return 0, &Error{Code: "500", Msg: "新增字典失败"}
	}
	if exists {
		return 0, &Error{Code: "400", Msg: fmt.Sprintf("新增失败，[%s] 已存在", req.Code)}
	}

	idVal := s.next()
	now := time.Now()
	if err := s.repo.CreateDict(ctx, idVal, req.Name, req.Code, req.Description, userID, now); err != nil {
		return 0, &Error{Code: "500", Msg: "新增字典失败"}
	}
	return idVal, nil
}

func (s *Service) UpdateDict(ctx context.Context, userID int64, id int64, req DictUpdateRequest) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	if req.Name == "" {
		return &Error{Code: "400", Msg: "名称不能为空"}
	}

	if err := s.repo.UpdateDict(ctx, id, req.Name, req.Description, userID, time.Now()); err != nil {
		return &Error{Code: "500", Msg: "修改字典失败"}
	}
	return nil
}

func (s *Service) DeleteDict(ctx context.Context, userID int64, ids []int64) *Error {
	_ = userID
	if len(ids) == 0 {
		return &Error{Code: "400", Msg: "ID 列表不能为空"}
	}
	if err := s.repo.DeleteDict(ctx, ids); err != nil {
		return &Error{Code: "500", Msg: "删除字典失败"}
	}
	return nil
}

func (s *Service) PageDictItem(ctx context.Context, q DictItemPageQuery) ([]DictItem, int64, *Error) {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Size <= 0 {
		q.Size = 10
	}
	q.Description = strings.TrimSpace(q.Description)
	items, total, err := s.repo.PageDictItem(ctx, q)
	if err != nil {
		return nil, 0, &Error{Code: "500", Msg: "查询字典项失败"}
	}
	return items, total, nil
}

func (s *Service) GetDictItem(ctx context.Context, id int64) (*DictItem, *Error) {
	if id <= 0 {
		return nil, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	item, err := s.repo.GetDictItem(ctx, id)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询字典项失败"}
	}
	if item == nil {
		return nil, &Error{Code: "404", Msg: "字典项不存在"}
	}
	return item, nil
}

func (s *Service) CreateDictItem(ctx context.Context, userID int64, req DictItemCreateRequest) (int64, *Error) {
	req.Label = strings.TrimSpace(req.Label)
	req.Value = strings.TrimSpace(req.Value)
	req.Color = strings.TrimSpace(req.Color)
	req.Description = strings.TrimSpace(req.Description)
	if req.Label == "" || req.Value == "" || req.DictID == 0 {
		return 0, &Error{Code: "400", Msg: "标签、值和字典 ID 不能为空"}
	}
	if req.Sort <= 0 {
		req.Sort = 999
	}
	if req.Status == 0 {
		req.Status = 1
	}

	idVal := s.next()
	now := time.Now()
	if err := s.repo.CreateDictItem(ctx, idVal, req, userID, now); err != nil {
		return 0, &Error{Code: "500", Msg: "新增字典项失败"}
	}
	return idVal, nil
}

func (s *Service) UpdateDictItem(ctx context.Context, userID int64, id int64, req DictItemUpdateRequest) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	req.Label = strings.TrimSpace(req.Label)
	req.Value = strings.TrimSpace(req.Value)
	req.Color = strings.TrimSpace(req.Color)
	req.Description = strings.TrimSpace(req.Description)
	if req.Label == "" || req.Value == "" {
		return &Error{Code: "400", Msg: "标签和值不能为空"}
	}
	if req.Sort <= 0 {
		req.Sort = 999
	}
	if req.Status == 0 {
		req.Status = 1
	}

	if err := s.repo.UpdateDictItem(ctx, id, req, userID, time.Now()); err != nil {
		return &Error{Code: "500", Msg: "修改字典项失败"}
	}
	return nil
}

func (s *Service) DeleteDictItem(ctx context.Context, userID int64, ids []int64) *Error {
	_ = userID
	if len(ids) == 0 {
		return &Error{Code: "400", Msg: "ID 列表不能为空"}
	}
	if err := s.repo.DeleteDictItem(ctx, ids); err != nil {
		return &Error{Code: "500", Msg: "删除字典项失败"}
	}
	return nil
}

func (s *Service) next() int64 {
	if s == nil || s.nextID == nil {
		return 0
	}
	return s.nextID()
}
