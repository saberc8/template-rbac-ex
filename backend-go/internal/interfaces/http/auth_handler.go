package http

import (
	"strings"

	"github.com/gin-gonic/gin"

	"go-backend/internal/application/auth"
)

// AuthHandler 暴露认证相关 HTTP 接口。
type AuthHandler struct {
	online *OnlineStore
	uc     *auth.LoginUseCase
}

// NewAuthHandler 创建认证接口处理器。
func NewAuthHandler(uc *auth.LoginUseCase, online *OnlineStore) *AuthHandler {
	return &AuthHandler{
		online: online,
		uc:     uc,
	}
}

// RegisterAuthRoutes 注册 /auth 相关路由。
func (h *AuthHandler) RegisterAuthRoutes(r *gin.Engine) {
	r.POST("/auth/login", h.Login)
	r.POST("/auth/logout", h.Logout)
}

// Login 处理 POST /auth/login。
// @Summary 用户登录
// @Description 使用账号密码进行登录，可选启用图形验证码。
// @Tags 认证
// @Accept json
// @Produce json
// @Param data body auth.LoginRequest true "登录请求参数"
// @Success 200 {object} map[string]interface{} "统一响应包装，data 为 LoginResponse"
// @Failure 200 {object} map[string]interface{} "失败时 code!=200，msg 为错误信息"
// @Router /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req auth.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// 参数缺失或格式不正确
		Fail(c, "400", "参数缺失或格式不正确")
		return
	}

	resp, err := h.uc.Login(c.Request.Context(), req)
	if err != nil {
		FailErr(c, err)
		return
	}

	// 登录成功后记录在线用户信息（仅在当前 Go 进程内维护内存状态）。
	if h.online != nil && resp != nil {
		h.online.RecordLogin(c, resp.UserID, resp.Username, resp.Nickname, req.ClientID, resp.Token)
	}

	// Successful login, return LoginResp as data.
	c.Header("Content-Type", "application/json; charset=utf-8")
	OK(c, resp)
}

// Logout 处理 POST /auth/logout。
// 前端仅依赖服务端返回成功，本实现主要用于清理 Go 进程内的在线用户列表。
// @Summary 用户登出
// @Description 基于 Authorization Bearer Token 进行登出，仅清理服务端在线用户。
// @Tags 认证
// @Produce json
// @Success 200 {object} map[string]interface{} "统一响应包装，data 为 true/false"
// @Router /auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	authz := c.GetHeader("Authorization")
	token := strings.TrimSpace(authz)
	if strings.HasPrefix(strings.ToLower(token), "bearer ") {
		token = strings.TrimSpace(token[7:])
	}
	if token != "" && h.online != nil {
		h.online.RemoveByToken(token)
	}
	OK(c, true)
}
