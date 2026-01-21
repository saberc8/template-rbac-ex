package http

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	apprbac "go-backend/internal/application/rbac"
	domainrbac "go-backend/internal/domain/rbac"
)

// RoleResp matches RoleResp in admin/src/apis/system/type.ts.
type RoleResp struct {
	ID               int64  `json:"id"`
	Name             string `json:"name"`
	Code             string `json:"code"`
	Sort             int32  `json:"sort"`
	Description      string `json:"description"`
	DataScope        int32  `json:"dataScope"`
	IsSystem         bool   `json:"isSystem"`
	CreateUserString string `json:"createUserString"`
	CreateTime       string `json:"createTime"`
	UpdateUserString string `json:"updateUserString"`
	UpdateTime       string `json:"updateTime"`
	Disabled         bool   `json:"disabled"`
}

// RoleDetailResp extends RoleResp with menu/dept information.
type RoleDetailResp struct {
	RoleResp
	MenuIDs         []int64 `json:"menuIds"`
	DeptIDs         []int64 `json:"deptIds"`
	MenuCheckStrict bool    `json:"menuCheckStrictly"`
	DeptCheckStrict bool    `json:"deptCheckStrictly"`
}

// RoleUserResp matches RoleUserResp at front-end.
type RoleUserResp struct {
	ID          int64    `json:"id"` // sys_user_role.id
	RoleID      int64    `json:"roleId"`
	UserID      int64    `json:"userId"`
	Username    string   `json:"username"`
	Nickname    string   `json:"nickname"`
	Gender      int16    `json:"gender"`
	Status      int16    `json:"status"`
	IsSystem    bool     `json:"isSystem"`
	Description string   `json:"description"`
	DeptID      int64    `json:"deptId"`
	DeptName    string   `json:"deptName"`
	RoleIDs     []int64  `json:"roleIds"`
	RoleNames   []string `json:"roleNames"`
	Disabled    bool     `json:"disabled"`
}

type roleReq struct {
	Name            string  `json:"name"`
	Code            string  `json:"code"`
	Sort            int32   `json:"sort"`
	Description     string  `json:"description"`
	DataScope       int32   `json:"dataScope"`
	DeptIDs         []int64 `json:"deptIds"`
	DeptCheckStrict bool    `json:"deptCheckStrictly"`
}

type rolePermissionReq struct {
	MenuIDs         []int64 `json:"menuIds"`
	MenuCheckStrict bool    `json:"menuCheckStrictly"`
}

// RoleHandler provides /system/role endpoints.
type RoleHandler struct {
	svc *apprbac.RoleService
}

func NewRoleHandler(svc *apprbac.RoleService) *RoleHandler {
	return &RoleHandler{svc: svc}
}

// RegisterRoleRoutes registers role management routes.
func (h *RoleHandler) RegisterRoleRoutes(r *gin.Engine) {
	r.GET("/system/role/list", h.ListRole)
	r.GET("/system/role/:id", h.GetRole)
	r.POST("/system/role", h.CreateRole)
	r.PUT("/system/role/:id", h.UpdateRole)
	r.DELETE("/system/role", h.DeleteRole)

	r.PUT("/system/role/:id/permission", h.UpdateRolePermission)
	r.GET("/system/role/:id/user", h.PageRoleUser)
	r.POST("/system/role/:id/user", h.AssignToUsers)
	r.DELETE("/system/role/user", h.UnassignFromUsers)
	r.GET("/system/role/:id/user/id", h.ListRoleUserIDs)
}

// ListRole handles GET /system/role/list.
func (h *RoleHandler) ListRole(c *gin.Context) {
	descFilter := strings.TrimSpace(c.Query("description"))
	list, derr := h.svc.List(c.Request.Context(), descFilter)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	out := make([]RoleResp, 0, len(list))
	for _, row := range list {
		item := toRoleResp(row)
		item.Disabled = item.IsSystem && item.Code == "admin"
		out = append(out, item)
	}
	OK(c, out)
}

// GetRole handles GET /system/role/:id.
func (h *RoleHandler) GetRole(c *gin.Context) {
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	row, derr := h.svc.Get(c.Request.Context(), idVal)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	base := toRoleResp(row.RoleDetail)
	base.Disabled = base.IsSystem && base.Code == "admin"

	resp := RoleDetailResp{
		RoleResp:        base,
		MenuIDs:         row.MenuIDs,
		DeptIDs:         row.DeptIDs,
		MenuCheckStrict: row.MenuCheckStrictly,
		DeptCheckStrict: row.DeptCheckStrictly,
	}
	OK(c, resp)
}

// CreateRole handles POST /system/role.
func (h *RoleHandler) CreateRole(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req roleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}

	idVal, derr := h.svc.Create(c.Request.Context(), userID, apprbac.RoleSave{
		Name:            req.Name,
		Code:            req.Code,
		Sort:            req.Sort,
		Description:     req.Description,
		DataScope:       req.DataScope,
		DeptIDs:         req.DeptIDs,
		DeptCheckStrict: req.DeptCheckStrict,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, gin.H{"id": idVal})
}

// UpdateRole handles PUT /system/role/:id.
func (h *RoleHandler) UpdateRole(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req roleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}

	if derr := h.svc.Update(c.Request.Context(), userID, idVal, apprbac.RoleSave{
		Name:            req.Name,
		Code:            req.Code,
		Sort:            req.Sort,
		Description:     req.Description,
		DataScope:       req.DataScope,
		DeptIDs:         req.DeptIDs,
		DeptCheckStrict: req.DeptCheckStrict,
	}); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// DeleteRole handles DELETE /system/role.
func (h *RoleHandler) DeleteRole(c *gin.Context) {
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

// UpdateRolePermission handles PUT /system/role/:id/permission.
func (h *RoleHandler) UpdateRolePermission(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req rolePermissionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}

	if derr := h.svc.UpdatePermission(c.Request.Context(), userID, idVal, apprbac.RolePermissionSave{
		MenuIDs:         req.MenuIDs,
		MenuCheckStrict: req.MenuCheckStrict,
	}); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// PageRoleUser handles GET /system/role/:id/user (分页查询关联用户).
func (h *RoleHandler) PageRoleUser(c *gin.Context) {
	roleID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || roleID <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}
	page, _ := strconv.Atoi(c.Query("page"))
	size, _ := strconv.Atoi(c.Query("size"))
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 10
	}
	descFilter := strings.TrimSpace(c.Query("description"))

	list, total, derr := h.svc.PageRoleUsers(c.Request.Context(), roleID, descFilter, page, size)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	out := make([]RoleUserResp, 0, len(list))
	for _, row := range list {
		item := RoleUserResp{
			ID:          row.ID,
			RoleID:      row.RoleID,
			UserID:      row.UserID,
			Username:    row.Username,
			Nickname:    row.Nickname,
			Gender:      row.Gender,
			Status:      row.Status,
			IsSystem:    row.IsSystem,
			Description: row.Description,
			DeptID:      row.DeptID,
			DeptName:    row.DeptName,
			RoleIDs:     row.RoleIDs,
			RoleNames:   row.RoleNames,
			Disabled:    row.Disabled,
		}
		out = append(out, item)
	}

	OK(c, PageResult[RoleUserResp]{List: out, Total: total})
}

// AssignToUsers handles POST /system/role/:id/user.
func (h *RoleHandler) AssignToUsers(c *gin.Context) {
	_, ok := RequireUserID(c)
	if !ok {
		return
	}
	roleID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || roleID <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var userIDs []int64
	if err := c.ShouldBindJSON(&userIDs); err != nil || len(userIDs) == 0 {
		Fail(c, "400", "用户ID列表不能为空")
		return
	}

	if derr := h.svc.AssignToUsers(c.Request.Context(), roleID, userIDs); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// UnassignFromUsers handles DELETE /system/role/user.
// Body is an array of userRoleIds.
func (h *RoleHandler) UnassignFromUsers(c *gin.Context) {
	_, ok := RequireUserID(c)
	if !ok {
		return
	}

	var ids []int64
	if err := c.ShouldBindJSON(&ids); err != nil || len(ids) == 0 {
		Fail(c, "400", "用户角色ID列表不能为空")
		return
	}

	if derr := h.svc.UnassignFromUsers(c.Request.Context(), ids); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// ListRoleUserIDs handles GET /system/role/:id/user/id.
func (h *RoleHandler) ListRoleUserIDs(c *gin.Context) {
	roleID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || roleID <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	ids, derr := h.svc.ListRoleUserIDs(c.Request.Context(), roleID)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, ids)
}

func toRoleResp(row domainrbac.RoleDetail) RoleResp {
	item := RoleResp{
		ID:               row.ID,
		Name:             row.Name,
		Code:             row.Code,
		Sort:             row.Sort,
		Description:      row.Description,
		DataScope:        row.DataScope,
		IsSystem:         row.IsSystem,
		CreateUserString: row.CreateUserString,
		CreateTime:       formatTime(row.CreateTime),
		UpdateUserString: row.UpdateUserString,
	}
	if row.UpdateTime != nil && !row.UpdateTime.IsZero() {
		item.UpdateTime = formatTime(*row.UpdateTime)
	}
	return item
}
