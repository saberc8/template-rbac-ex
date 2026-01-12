package http

import (
	"github.com/gin-gonic/gin"

	appauth "voc-go-backend/internal/application/auth"
	rbac "voc-go-backend/internal/domain/rbac"
	"voc-go-backend/internal/domain/user"
)

// UserHandler exposes /auth/user related endpoints (info, route).
type UserHandler struct {
	users user.Repository
	roles rbac.RoleRepository
	menus rbac.MenuRepository
}

func NewUserHandler(
	users user.Repository,
	roles rbac.RoleRepository,
	menus rbac.MenuRepository,
) *UserHandler {
	return &UserHandler{
		users: users,
		roles: roles,
		menus: menus,
	}
}

// RegisterUserRoutes registers /auth/user endpoints.
func (h *UserHandler) RegisterUserRoutes(r *gin.Engine) {
	r.GET("/auth/user/info", h.GetUserInfo)
	r.GET("/auth/user/route", h.ListUserRoute)
}

// GetUserInfo handles GET /auth/user/info.
func (h *UserHandler) GetUserInfo(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	domainUser, err := h.users.GetByID(c.Request.Context(), userID)
	if err != nil {
		Fail(c, "401", "未授权，请重新登录")
		return
	}
	if domainUser == nil {
		Fail(c, "401", "未授权，请重新登录")
		return
	}
	// 角色与权限
	roles, err := h.roles.ListByUserID(c.Request.Context(), userID)
	if err != nil {
		Fail(c, "500", "获取角色信息失败")
		return
	}
	roleCodes := appauth.ExtractRoleCodes(roles)

	perms, err := h.menus.ListPermissionsByUserID(c.Request.Context(), userID)
	if err != nil {
		Fail(c, "500", "获取权限信息失败")
		return
	}

	info := appauth.BuildUserInfo(domainUser, roleCodes, perms, "", false)
	OK(c, info)
}

// ListUserRoute returns an empty route list for now.
func (h *UserHandler) ListUserRoute(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	// Load roles and menus for this user.
	roles, err := h.roles.ListByUserID(c.Request.Context(), userID)
	if err != nil {
		Fail(c, "500", "获取角色信息失败")
		return
	}
	if len(roles) == 0 {
		OK(c, []appauth.RouteItem{})
		return
	}

	// Collect menus for all roles (de-duplicated by id).
	menuMap := make(map[int64]rbac.Menu)
	for _, rctx := range roles {
		menus, err := h.menus.ListByRoleID(c.Request.Context(), rctx.ID)
		if err != nil {
			Fail(c, "500", "获取菜单信息失败")
			return
		}
		for _, m := range menus {
			menuMap[m.ID] = m
		}
	}
	flatMenus := make([]rbac.Menu, 0, len(menuMap))
	for _, m := range menuMap {
		flatMenus = append(flatMenus, m)
	}

	roleCodes := appauth.ExtractRoleCodes(roles)
	tree := appauth.BuildRouteTree(flatMenus, roleCodes)
	OK(c, tree)
}
