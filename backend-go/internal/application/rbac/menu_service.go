package rbac

import (
	"context"
	"database/sql"
	"strings"
	"time"

	domainrbac "go-backend/internal/domain/rbac"
)

// MenuService 提供菜单管理的用例编排（sys_menu）。
type MenuService struct {
	repo   domainrbac.MenuAdminRepository
	nextID func() int64
	now    func() time.Time
}

func NewMenuService(repo domainrbac.MenuAdminRepository, nextID func() int64) *MenuService {
	return &MenuService{
		repo:   repo,
		nextID: nextID,
		now:    time.Now,
	}
}

func (s *MenuService) ListAll(ctx context.Context) ([]domainrbac.MenuDetail, *Error) {
	list, err := s.repo.ListAll(ctx)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询菜单失败"}
	}
	return list, nil
}

func (s *MenuService) Get(ctx context.Context, id int64) (*domainrbac.MenuDetail, *Error) {
	if id <= 0 {
		return nil, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	item, err := s.repo.Get(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, &Error{Code: "404", Msg: "菜单不存在"}
		}
		return nil, &Error{Code: "500", Msg: "查询菜单失败"}
	}
	return item, nil
}

type MenuSave struct {
	Type       int16
	Icon       string
	Title      string
	Sort       int32
	Permission string
	Path       string
	Name       string
	Component  string
	Redirect   string
	IsExternal *bool
	IsCache    *bool
	IsHidden   *bool
	ParentID   int64
	Status     int16
}

func (s *MenuService) Create(ctx context.Context, userID int64, req MenuSave) (int64, *Error) {
	m, derr := s.buildMenuForSave(userID, 0, req)
	if derr != nil {
		return 0, derr
	}
	m.ID = s.nextID()
	if m.ID <= 0 {
		return 0, &Error{Code: "500", Msg: "新增菜单失败"}
	}
	now := s.now()
	m.CreateUser = &userID
	m.CreateTime = now
	if err := s.repo.Create(ctx, m); err != nil {
		return 0, &Error{Code: "500", Msg: "新增菜单失败"}
	}
	return m.ID, nil
}

func (s *MenuService) Update(ctx context.Context, userID int64, id int64, req MenuSave) *Error {
	m, derr := s.buildMenuForSave(userID, id, req)
	if derr != nil {
		return derr
	}
	now := s.now()
	m.UpdateUser = &userID
	m.UpdateTime = &now
	if err := s.repo.Update(ctx, m); err != nil {
		return &Error{Code: "500", Msg: "修改菜单失败"}
	}
	return nil
}

func (s *MenuService) Delete(ctx context.Context, ids []int64) *Error {
	if len(ids) == 0 {
		return &Error{Code: "400", Msg: "ID 列表不能为空"}
	}
	if err := s.repo.DeleteCascade(ctx, ids); err != nil {
		return &Error{Code: "500", Msg: "删除菜单失败"}
	}
	return nil
}

func (s *MenuService) buildMenuForSave(userID int64, id int64, req MenuSave) (*domainrbac.Menu, *Error) {
	_ = userID

	if req.Type == 0 {
		req.Type = 1
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, &Error{Code: "400", Msg: "菜单标题不能为空"}
	}

	isExternal := false
	if req.IsExternal != nil {
		isExternal = *req.IsExternal
	}
	isCache := false
	if req.IsCache != nil {
		isCache = *req.IsCache
	}
	isHidden := false
	if req.IsHidden != nil {
		isHidden = *req.IsHidden
	}

	path := strings.TrimSpace(req.Path)
	name := strings.TrimSpace(req.Name)
	component := strings.TrimSpace(req.Component)
	if isExternal {
		if !(strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://")) {
			return nil, &Error{Code: "400", Msg: "路由地址格式不正确，请以 http:// 或 https:// 开头"}
		}
	} else {
		if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
			return nil, &Error{Code: "400", Msg: "路由地址格式不正确"}
		}
		if path != "" && !strings.HasPrefix(path, "/") {
			path = "/" + path
		}
		name = strings.TrimPrefix(name, "/")
		component = strings.TrimPrefix(component, "/")
	}

	sort := req.Sort
	if sort <= 0 {
		sort = 999
	}
	status := req.Status
	if status == 0 {
		status = 1
	}

	if id < 0 {
		return nil, &Error{Code: "400", Msg: "ID 参数不正确"}
	}

	return &domainrbac.Menu{
		ID:         id,
		ParentID:   req.ParentID,
		Title:      title,
		Type:       domainrbac.MenuType(req.Type),
		Path:       path,
		Name:       name,
		Component:  component,
		Redirect:   strings.TrimSpace(req.Redirect),
		Icon:       strings.TrimSpace(req.Icon),
		IsExternal: isExternal,
		IsCache:    isCache,
		IsHidden:   isHidden,
		Permission: strings.TrimSpace(req.Permission),
		Sort:       sort,
		Status:     status,
	}, nil
}
