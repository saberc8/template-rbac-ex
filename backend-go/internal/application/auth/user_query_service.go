package auth

import (
	"context"

	domainrbac "go-backend/internal/domain/rbac"
	domainuser "go-backend/internal/domain/user"
)

// UserQueryService 提供 /auth/user/* 相关的用例编排，避免在 HTTP 层拼装跨仓储逻辑。
type UserQueryService struct {
	users domainuser.Repository
	roles domainrbac.RoleRepository
	menus domainrbac.MenuRepository
}

func NewUserQueryService(
	users domainuser.Repository,
	roles domainrbac.RoleRepository,
	menus domainrbac.MenuRepository,
) *UserQueryService {
	return &UserQueryService{
		users: users,
		roles: roles,
		menus: menus,
	}
}

func (s *UserQueryService) GetUserInfo(ctx context.Context, userID int64) (UserInfo, *Error) {
	if userID <= 0 {
		return UserInfo{}, &Error{Code: "401", Msg: "未授权，请重新登录"}
	}
	if s == nil || s.users == nil || s.roles == nil || s.menus == nil {
		return UserInfo{}, &Error{Code: "500", Msg: "服务未初始化"}
	}

	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return UserInfo{}, &Error{Code: "401", Msg: "未授权，请重新登录"}
	}
	if u == nil {
		return UserInfo{}, &Error{Code: "401", Msg: "未授权，请重新登录"}
	}

	roles, err := s.roles.ListByUserID(ctx, userID)
	if err != nil {
		return UserInfo{}, &Error{Code: "500", Msg: "获取角色信息失败"}
	}
	roleCodes := ExtractRoleCodes(roles)

	perms, err := s.menus.ListPermissionsByUserID(ctx, userID)
	if err != nil {
		return UserInfo{}, &Error{Code: "500", Msg: "获取权限信息失败"}
	}

	info := BuildUserInfo(u, roleCodes, perms, "", false)
	return info, nil
}

func (s *UserQueryService) ListUserRoute(ctx context.Context, userID int64) ([]RouteItem, *Error) {
	if userID <= 0 {
		return nil, &Error{Code: "401", Msg: "未授权，请重新登录"}
	}
	if s == nil || s.roles == nil || s.menus == nil {
		return nil, &Error{Code: "500", Msg: "服务未初始化"}
	}

	roles, err := s.roles.ListByUserID(ctx, userID)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "获取角色信息失败"}
	}
	if len(roles) == 0 {
		return []RouteItem{}, nil
	}

	menuMap := make(map[int64]domainrbac.Menu)
	for _, rctx := range roles {
		menus, err := s.menus.ListByRoleID(ctx, rctx.ID)
		if err != nil {
			return nil, &Error{Code: "500", Msg: "获取菜单信息失败"}
		}
		for _, m := range menus {
			menuMap[m.ID] = m
		}
	}
	flatMenus := make([]domainrbac.Menu, 0, len(menuMap))
	for _, m := range menuMap {
		flatMenus = append(flatMenus, m)
	}

	roleCodes := ExtractRoleCodes(roles)
	tree := BuildRouteTree(flatMenus, roleCodes)
	return tree, nil
}
