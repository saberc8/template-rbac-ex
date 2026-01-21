package http

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	appuser "go-backend/internal/application/user"
)

// UserResp matches UserResp in admin/src/apis/system/type.ts.
type UserResp struct {
	ID               int64    `json:"id"`
	Username         string   `json:"username"`
	Nickname         string   `json:"nickname"`
	Avatar           string   `json:"avatar"`
	Gender           int16    `json:"gender"`
	Email            string   `json:"email"`
	Phone            string   `json:"phone"`
	Description      string   `json:"description"`
	Status           int16    `json:"status"`
	IsSystem         bool     `json:"isSystem"`
	CreateUserString string   `json:"createUserString"`
	CreateTime       string   `json:"createTime"`
	UpdateUserString string   `json:"updateUserString"`
	UpdateTime       string   `json:"updateTime"`
	DeptID           int64    `json:"deptId"`
	DeptName         string   `json:"deptName"`
	RoleIDs          []int64  `json:"roleIds"`
	RoleNames        []string `json:"roleNames"`
	Disabled         bool     `json:"disabled"`
}

// UserDetailResp extends UserResp with pwdResetTime.
type UserDetailResp struct {
	UserResp
	PwdResetTime string `json:"pwdResetTime,omitempty"`
}

type userReq struct {
	Username    string  `json:"username"`
	Nickname    string  `json:"nickname"`
	Password    string  `json:"password"` // only for create
	Gender      int16   `json:"gender"`
	Email       string  `json:"email"`
	Phone       string  `json:"phone"`
	Avatar      string  `json:"avatar"`
	Description string  `json:"description"`
	Status      int16   `json:"status"`
	DeptID      int64   `json:"deptId"`
	RoleIDs     []int64 `json:"roleIds"`
}

type userPasswordResetReq struct {
	NewPassword string `json:"newPassword"`
}

type userRoleUpdateReq struct {
	RoleIDs []int64 `json:"roleIds"`
}

// UserImportParseResp is a simplified version of UserImportParseResp in Java.
type UserImportParseResp struct {
	ImportKey          string `json:"importKey"`
	TotalRows          int    `json:"totalRows"`
	ValidRows          int    `json:"validRows"`
	DuplicateUserRows  int    `json:"duplicateUserRows"`
	DuplicateEmailRows int    `json:"duplicateEmailRows"`
	DuplicatePhoneRows int    `json:"duplicatePhoneRows"`
}

// UserImportResultResp matches UserImportResp in Java (used as import result).
type UserImportResultResp struct {
	TotalRows  int `json:"totalRows"`
	InsertRows int `json:"insertRows"`
	UpdateRows int `json:"updateRows"`
}

// SystemUserHandler provides /system/user endpoints.
type SystemUserHandler struct {
	svc *appuser.AdminService
}

func NewSystemUserHandler(svc *appuser.AdminService) *SystemUserHandler {
	return &SystemUserHandler{svc: svc}
}

// RegisterSystemUserRoutes registers /system/user related routes.
func (h *SystemUserHandler) RegisterSystemUserRoutes(r *gin.Engine) {
	r.GET("/system/user", h.ListUserPage)
	r.GET("/system/user/list", h.ListAllUser)
	r.GET("/system/user/:id", h.GetUserDetail)
	r.POST("/system/user", h.CreateUser)
	r.PUT("/system/user/:id", h.UpdateUser)
	r.DELETE("/system/user", h.DeleteUser)
	r.PATCH("/system/user/:id/password", h.ResetPassword)
	r.PATCH("/system/user/:id/role", h.UpdateUserRole)

	// 导出与导入相关接口（简化实现）
	r.GET("/system/user/export", h.ExportUser)
	r.GET("/system/user/import/template", h.DownloadImportTemplate)
	r.POST("/system/user/import/parse", h.ParseImportUser)
	r.POST("/system/user/import", h.ImportUser)
}

// ListUserPage handles GET /system/user (分页查询用户).
func (h *SystemUserHandler) ListUserPage(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	size, _ := strconv.Atoi(c.Query("size"))
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 10
	}

	desc := strings.TrimSpace(c.Query("description"))
	statusStr := strings.TrimSpace(c.Query("status"))
	deptStr := strings.TrimSpace(c.Query("deptId"))

	var (
		statusFilter *int64
		deptID       *int64
	)
	if statusStr != "" {
		if v, err := strconv.ParseInt(statusStr, 10, 64); err == nil {
			statusFilter = &v
		}
	}
	if deptStr != "" {
		if v, err := strconv.ParseInt(deptStr, 10, 64); err == nil {
			deptID = &v
		}
	}
	list, total, derr := h.svc.Page(c.Request.Context(), appuser.UserPageQuery{
		Page:        page,
		Size:        size,
		Description: desc,
		Status:      statusFilter,
		DeptID:      deptID,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	if total == 0 || len(list) == 0 {
		OK(c, PageResult[UserResp]{List: []UserResp{}, Total: 0})
		return
	}
	users := make([]UserResp, 0, len(list))
	for _, row := range list {
		users = append(users, toUserResp(row))
	}
	OK(c, PageResult[UserResp]{List: users, Total: total})
}

// ListAllUser handles GET /system/user/list.
func (h *SystemUserHandler) ListAllUser(c *gin.Context) {
	idStrs := c.QueryArray("userIds")
	var ids []int64
	for _, s := range idStrs {
		if v, err := strconv.ParseInt(s, 10, 64); err == nil && v > 0 {
			ids = append(ids, v)
		}
	}

	list, derr := h.svc.List(c.Request.Context(), ids)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	users := make([]UserResp, 0, len(list))
	for _, row := range list {
		users = append(users, toUserResp(row))
	}
	OK(c, users)
}

// GetUserDetail handles GET /system/user/:id.
func (h *SystemUserHandler) GetUserDetail(c *gin.Context) {
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	row, derr := h.svc.GetDetail(c.Request.Context(), idVal)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	base := toUserResp(*row)
	detail := UserDetailResp{UserResp: base}
	if row.PwdResetTime != nil && !row.PwdResetTime.IsZero() {
		detail.PwdResetTime = formatTime(*row.PwdResetTime)
	}
	OK(c, detail)
}

// CreateUser handles POST /system/user.
func (h *SystemUserHandler) CreateUser(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req userReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	idVal, derr := h.svc.Create(c.Request.Context(), userID, appuser.UserSave{
		Username:    req.Username,
		Nickname:    req.Nickname,
		Password:    req.Password,
		Gender:      req.Gender,
		Email:       req.Email,
		Phone:       req.Phone,
		Avatar:      req.Avatar,
		Description: req.Description,
		Status:      req.Status,
		DeptID:      req.DeptID,
		RoleIDs:     req.RoleIDs,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, gin.H{"id": idVal})
}

// UpdateUser handles PUT /system/user/:id.
func (h *SystemUserHandler) UpdateUser(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req userReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	if derr := h.svc.Update(c.Request.Context(), userID, idVal, appuser.UserSave{
		Username:    req.Username,
		Nickname:    req.Nickname,
		Gender:      req.Gender,
		Email:       req.Email,
		Phone:       req.Phone,
		Avatar:      req.Avatar,
		Description: req.Description,
		Status:      req.Status,
		DeptID:      req.DeptID,
		RoleIDs:     req.RoleIDs,
	}); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// DeleteUser handles DELETE /system/user.
func (h *SystemUserHandler) DeleteUser(c *gin.Context) {
	_, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req idsRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		Fail(c, "400", "ID 列表不能为空")
		return
	}
	if derr := h.svc.Delete(c.Request.Context(), req.IDs); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// ResetPassword handles PATCH /system/user/:id/password.
func (h *SystemUserHandler) ResetPassword(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req userPasswordResetReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	if derr := h.svc.ResetPassword(c.Request.Context(), userID, idVal, req.NewPassword); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// UpdateUserRole handles PATCH /system/user/:id/role.
func (h *SystemUserHandler) UpdateUserRole(c *gin.Context) {
	_, ok := RequireUserID(c)
	if !ok {
		return
	}

	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req userRoleUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	if derr := h.svc.UpdateUserRole(c.Request.Context(), idVal, req.RoleIDs); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// ExportUser handles GET /system/user/export.
// It returns a very simple CSV file with basic user information.
func (h *SystemUserHandler) ExportUser(c *gin.Context) {
	rows, derr := h.svc.ExportRows(c.Request.Context())
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	var b strings.Builder
	b.WriteString("username,nickname,gender,email,phone\n")
	for _, r := range rows {
		line := fmt.Sprintf("%s,%s,%d,%s,%s\n", r.Username, r.Nickname, r.Gender, r.Email, r.Phone)
		b.WriteString(line)
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=\"users.csv\"")
	c.String(http.StatusOK, b.String())
}

// DownloadImportTemplate handles GET /system/user/import/template.
func (h *SystemUserHandler) DownloadImportTemplate(c *gin.Context) {
	content := "username,nickname,gender,email,phone\n"
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=\"user_import_template.csv\"")
	c.String(http.StatusOK, content)
}

// ParseImportUser handles POST /system/user/import/parse.
// 当前实现不真正解析 Excel，只返回一个空的解析结果，保证前端流程可用。
func (h *SystemUserHandler) ParseImportUser(c *gin.Context) {
	// 接收上传文件，但不做实际解析
	if _, err := c.FormFile("file"); err != nil {
		Fail(c, "400", "文件不能为空")
		return
	}
	resp := UserImportParseResp{
		ImportKey:          strconv.FormatInt(time.Now().UnixNano(), 10),
		TotalRows:          0,
		ValidRows:          0,
		DuplicateUserRows:  0,
		DuplicateEmailRows: 0,
		DuplicatePhoneRows: 0,
	}
	OK(c, resp)
}

// ImportUser handles POST /system/user/import.
// 当前实现为占位实现，不执行真正的导入逻辑。
func (h *SystemUserHandler) ImportUser(c *gin.Context) {
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	_ = body // 预留给未来扩展

	resp := UserImportResultResp{
		TotalRows:  0,
		InsertRows: 0,
		UpdateRows: 0,
	}
	OK(c, resp)
}

func toUserResp(row appuser.UserDetail) UserResp {
	u := row.AdminUserDetail
	resp := UserResp{
		ID:               u.ID,
		Username:         u.Username,
		Nickname:         u.Nickname,
		Avatar:           strPtrOrEmpty(u.Avatar),
		Gender:           u.Gender,
		Email:            strPtrOrEmpty(u.Email),
		Phone:            strPtrOrEmpty(u.Phone),
		Description:      strPtrOrEmpty(u.Description),
		Status:           u.Status,
		IsSystem:         u.IsSystem,
		CreateUserString: u.CreateUserString,
		CreateTime:       formatTime(u.CreateTime),
		UpdateUserString: u.UpdateUserString,
		DeptID:           u.DeptID,
		DeptName:         u.DeptName,
		RoleIDs:          row.RoleIDs,
		RoleNames:        row.RoleNames,
		Disabled:         u.IsSystem,
	}
	if u.UpdateTime != nil && !u.UpdateTime.IsZero() {
		resp.UpdateTime = formatTime(*u.UpdateTime)
	}
	return resp
}

func strPtrOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
