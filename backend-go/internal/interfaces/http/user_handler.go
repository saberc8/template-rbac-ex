package http

import (
	"github.com/gin-gonic/gin"

	appauth "go-backend/internal/application/auth"
)

// UserHandler exposes /auth/user related endpoints (info, route).
type UserHandler struct {
	svc *appauth.UserQueryService
}

func NewUserHandler(
	svc *appauth.UserQueryService,
) *UserHandler {
	return &UserHandler{
		svc: svc,
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

	if h == nil || h.svc == nil {
		Fail(c, "500", "服务未初始化")
		return
	}
	info, derr := h.svc.GetUserInfo(c.Request.Context(), userID)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, info)
}

// ListUserRoute handles GET /auth/user/route.
func (h *UserHandler) ListUserRoute(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	if h == nil || h.svc == nil {
		Fail(c, "500", "服务未初始化")
		return
	}
	route, derr := h.svc.ListUserRoute(c.Request.Context(), userID)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, route)
}
