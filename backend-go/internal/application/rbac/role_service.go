package rbac

import (
	"context"
	"database/sql"
	"strings"
	"time"

	domainrbac "voc-go-backend/internal/domain/rbac"
)

// RoleService 提供角色管理的用例编排（sys_role + 关联表）。
type RoleService struct {
	repo   domainrbac.RoleAdminRepository
	nextID func() int64
	now    func() time.Time
}

func NewRoleService(repo domainrbac.RoleAdminRepository, nextID func() int64) *RoleService {
	return &RoleService{
		repo:   repo,
		nextID: nextID,
		now:    time.Now,
	}
}

type RoleSave struct {
	Name            string
	Code            string
	Sort            int32
	Description     string
	DataScope       int32
	DeptIDs         []int64
	DeptCheckStrict bool
}

type RolePermissionSave struct {
	MenuIDs         []int64
	MenuCheckStrict bool
}

type RoleUserPageItem struct {
	domainrbac.RoleUserDetail
	RoleIDs   []int64
	RoleNames []string
	Disabled  bool
}

func (s *RoleService) List(ctx context.Context, descFilter string) ([]domainrbac.RoleDetail, *Error) {
	list, err := s.repo.ListAll(ctx)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询角色失败"}
	}
	descFilter = strings.TrimSpace(descFilter)
	if descFilter == "" {
		return list, nil
	}
	out := make([]domainrbac.RoleDetail, 0, len(list))
	for _, it := range list {
		if strings.Contains(it.Name, descFilter) || strings.Contains(it.Description, descFilter) {
			out = append(out, it)
		}
	}
	return out, nil
}

func (s *RoleService) Get(ctx context.Context, id int64) (*domainrbac.RoleDetailWithRelations, *Error) {
	if id <= 0 {
		return nil, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	item, err := s.repo.GetDetail(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, &Error{Code: "404", Msg: "角色不存在"}
		}
		return nil, &Error{Code: "500", Msg: "查询角色失败"}
	}
	return item, nil
}

func (s *RoleService) Create(ctx context.Context, userID int64, req RoleSave) (int64, *Error) {
	name := strings.TrimSpace(req.Name)
	code := strings.TrimSpace(req.Code)
	if name == "" || code == "" {
		return 0, &Error{Code: "400", Msg: "名称和编码不能为空"}
	}
	sort := req.Sort
	if sort <= 0 {
		sort = 999
	}
	dataScope := req.DataScope
	if dataScope == 0 {
		dataScope = 4
	}
	now := s.now()
	idVal := s.nextID()
	if idVal <= 0 {
		return 0, &Error{Code: "500", Msg: "新增角色失败"}
	}

	role := &domainrbac.Role{
		ID:                idVal,
		Name:              name,
		Code:              code,
		Sort:              sort,
		Description:       strings.TrimSpace(req.Description),
		DataScope:         dataScope,
		IsSystem:          false,
		MenuCheckStrictly: true,
		DeptCheckStrictly: req.DeptCheckStrict,
		CreateUser:        &userID,
		CreateTime:        now,
	}
	if err := s.repo.Create(ctx, role, req.DeptIDs); err != nil {
		return 0, &Error{Code: "500", Msg: "新增角色失败"}
	}
	return idVal, nil
}

func (s *RoleService) Update(ctx context.Context, userID int64, id int64, req RoleSave) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return &Error{Code: "400", Msg: "名称不能为空"}
	}
	sort := req.Sort
	if sort <= 0 {
		sort = 999
	}
	dataScope := req.DataScope
	if dataScope == 0 {
		dataScope = 4
	}

	now := s.now()
	role := &domainrbac.Role{
		ID:                id,
		Name:              name,
		Sort:              sort,
		Description:       strings.TrimSpace(req.Description),
		DataScope:         dataScope,
		DeptCheckStrictly: req.DeptCheckStrict,
		UpdateUser:        &userID,
		UpdateTime:        &now,
	}
	if err := s.repo.Update(ctx, role, req.DeptIDs); err != nil {
		return &Error{Code: "500", Msg: "修改角色失败"}
	}
	return nil
}

func (s *RoleService) Delete(ctx context.Context, ids []int64) *Error {
	if len(ids) == 0 {
		return &Error{Code: "400", Msg: "ID 列表不能为空"}
	}
	if err := s.repo.Delete(ctx, ids); err != nil {
		return &Error{Code: "500", Msg: "删除角色失败"}
	}
	return nil
}

func (s *RoleService) UpdatePermission(ctx context.Context, userID int64, roleID int64, req RolePermissionSave) *Error {
	if roleID <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	if err := s.repo.UpdatePermission(ctx, roleID, req.MenuIDs, req.MenuCheckStrict, userID); err != nil {
		return &Error{Code: "500", Msg: "保存角色菜单失败"}
	}
	return nil
}

func (s *RoleService) PageRoleUsers(ctx context.Context, roleID int64, descFilter string, page, size int) ([]RoleUserPageItem, int64, *Error) {
	if roleID <= 0 {
		return nil, 0, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 30
	}

	all, err := s.repo.ListRoleUsers(ctx, roleID)
	if err != nil {
		return nil, 0, &Error{Code: "500", Msg: "查询关联用户失败"}
	}

	descFilter = strings.TrimSpace(descFilter)
	filtered := make([]domainrbac.RoleUserDetail, 0, len(all))
	if descFilter == "" {
		filtered = all
	} else {
		for _, it := range all {
			if strings.Contains(it.Username, descFilter) || strings.Contains(it.Nickname, descFilter) || strings.Contains(it.Description, descFilter) {
				filtered = append(filtered, it)
			}
		}
	}

	total := int64(len(filtered))
	start := (page - 1) * size
	if start > len(filtered) {
		start = len(filtered)
	}
	end := start + size
	if end > len(filtered) {
		end = len(filtered)
	}
	pageList := filtered[start:end]

	userIDs := make([]int64, 0, len(pageList))
	seen := make(map[int64]struct{})
	for _, it := range pageList {
		if it.UserID <= 0 {
			continue
		}
		if _, ok := seen[it.UserID]; ok {
			continue
		}
		seen[it.UserID] = struct{}{}
		userIDs = append(userIDs, it.UserID)
	}

	roleMap := map[int64][]domainrbac.RoleBrief{}
	if len(userIDs) > 0 {
		m, err := s.repo.ListUserRoles(ctx, userIDs)
		if err != nil {
			return nil, 0, &Error{Code: "500", Msg: "查询用户角色失败"}
		}
		roleMap = m
	}

	out := make([]RoleUserPageItem, 0, len(pageList))
	for _, it := range pageList {
		item := RoleUserPageItem{RoleUserDetail: it}
		if roles := roleMap[it.UserID]; len(roles) > 0 {
			item.RoleIDs = make([]int64, 0, len(roles))
			item.RoleNames = make([]string, 0, len(roles))
			for _, r := range roles {
				item.RoleIDs = append(item.RoleIDs, r.RoleID)
				item.RoleNames = append(item.RoleNames, r.RoleName)
			}
		}
		item.Disabled = item.IsSystem && item.RoleID == 1
		out = append(out, item)
	}

	return out, total, nil
}

func (s *RoleService) AssignToUsers(ctx context.Context, roleID int64, userIDs []int64) *Error {
	if roleID <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	if len(userIDs) == 0 {
		return &Error{Code: "400", Msg: "用户ID列表不能为空"}
	}

	validIDs := make([]int64, 0, len(userIDs))
	userRoleIDs := make([]int64, 0, len(userIDs))
	for _, uid := range userIDs {
		if uid <= 0 {
			continue
		}
		idVal := s.nextID()
		if idVal <= 0 {
			return &Error{Code: "500", Msg: "分配用户失败"}
		}
		validIDs = append(validIDs, uid)
		userRoleIDs = append(userRoleIDs, idVal)
	}
	if len(validIDs) == 0 {
		return nil
	}

	if err := s.repo.AssignUsers(ctx, roleID, userRoleIDs, validIDs); err != nil {
		return &Error{Code: "500", Msg: "分配用户失败"}
	}
	return nil
}

func (s *RoleService) UnassignFromUsers(ctx context.Context, ids []int64) *Error {
	if len(ids) == 0 {
		return &Error{Code: "400", Msg: "用户角色ID列表不能为空"}
	}
	if err := s.repo.UnassignUserRoles(ctx, ids); err != nil {
		return &Error{Code: "500", Msg: "取消分配失败"}
	}
	return nil
}

func (s *RoleService) ListRoleUserIDs(ctx context.Context, roleID int64) ([]int64, *Error) {
	if roleID <= 0 {
		return nil, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	ids, err := s.repo.ListRoleUserIDs(ctx, roleID)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询关联用户失败"}
	}
	return ids, nil
}

