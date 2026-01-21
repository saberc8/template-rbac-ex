package http

import (
	"encoding/csv"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	appsystem "go-backend/internal/application/system"
)

// DeptResp matches DeptResp in admin/src/apis/system/type.ts.
type DeptResp struct {
	ID               int64      `json:"id"`
	Name             string     `json:"name"`
	Sort             int32      `json:"sort"`
	Status           int16      `json:"status"`
	IsSystem         bool       `json:"isSystem"`
	Description      string     `json:"description"`
	CreateUserString string     `json:"createUserString"`
	CreateTime       string     `json:"createTime"`
	UpdateUserString string     `json:"updateUserString"`
	UpdateTime       string     `json:"updateTime"`
	ParentID         int64      `json:"parentId"`
	Children         []DeptResp `json:"children"`
}

// DeptQuery represents /system/dept/tree query parameters.
type DeptQuery struct {
	Description string
	Status      int64
}

// deptReq represents create/update request body for department.
type deptReq struct {
	Name        string `json:"name"`
	ParentID    int64  `json:"parentId"`
	Sort        int32  `json:"sort"`
	Status      int16  `json:"status"`
	Description string `json:"description"`
}

// DeptHandler provides /system/dept endpoints.
type DeptHandler struct {
	svc *appsystem.Service
}

func NewDeptHandler(svc *appsystem.Service) *DeptHandler {
	return &DeptHandler{
		svc: svc,
	}
}

// RegisterDeptRoutes registers /system/dept related routes.
func (h *DeptHandler) RegisterDeptRoutes(r *gin.Engine) {
	r.GET("/system/dept/tree", h.ListDeptTree)
	r.GET("/system/dept/:id", h.GetDept)
	r.POST("/system/dept", h.CreateDept)
	r.PUT("/system/dept/:id", h.UpdateDept)
	r.DELETE("/system/dept", h.DeleteDept)
	r.GET("/system/dept/export", h.ExportDept)
}

// ListDeptTree handles GET /system/dept/tree and returns a department tree list
// with the full DeptResp structure, keeping response compatible with the front-end.
func (h *DeptHandler) ListDeptTree(c *gin.Context) {
	// Parse filters from query
	desc := strings.TrimSpace(c.Query("description"))
	statusStr := strings.TrimSpace(c.Query("status"))

	var status int64
	if statusStr != "" {
		if v, err := strconv.ParseInt(statusStr, 10, 64); err == nil && v > 0 {
			status = v
		}
	}

	flat, derr := h.svc.ListDept(c.Request.Context(), desc, status)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	if len(flat) == 0 {
		OK(c, []DeptResp{})
		return
	}

	// Build id -> node map first
	nodeMap := make(map[int64]*DeptResp, len(flat))
	for _, d := range flat {
		resp := &DeptResp{
			ID:               d.ID,
			Name:             d.Name,
			Sort:             d.Sort,
			Status:           d.Status,
			IsSystem:         d.IsSystem,
			Description:      d.Description,
			CreateUserString: d.CreateUserString,
			CreateTime:       d.CreateTime.Format(time.RFC3339),
			UpdateUserString: d.UpdateUserString,
			ParentID:         d.ParentID,
		}
		if d.UpdateTime != nil && !d.UpdateTime.IsZero() {
			resp.UpdateTime = d.UpdateTime.Format(time.RFC3339)
		}
		nodeMap[d.ID] = resp
	}

	// Assemble tree structure
	var roots []*DeptResp
	for _, d := range flat {
		node := nodeMap[d.ID]
		if d.ParentID == 0 {
			roots = append(roots, node)
			continue
		}
		parent, ok := nodeMap[d.ParentID]
		if !ok {
			roots = append(roots, node)
			continue
		}
		parent.Children = append(parent.Children, *node)
	}

	result := make([]DeptResp, 0, len(roots))
	for _, n := range roots {
		result = append(result, *n)
	}
	OK(c, result)
}

// GetDept handles GET /system/dept/:id and returns single department detail.
func (h *DeptHandler) GetDept(c *gin.Context) {
	idStr := c.Param("id")
	idVal, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "无效的部门 ID")
		return
	}

	d, derr := h.svc.GetDept(c.Request.Context(), idVal)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	resp := DeptResp{
		ID:               d.ID,
		Name:             d.Name,
		Sort:             d.Sort,
		Status:           d.Status,
		IsSystem:         d.IsSystem,
		Description:      d.Description,
		CreateUserString: d.CreateUserString,
		CreateTime:       d.CreateTime.Format(time.RFC3339),
		UpdateUserString: d.UpdateUserString,
		ParentID:         d.ParentID,
	}
	if d.UpdateTime != nil && !d.UpdateTime.IsZero() {
		resp.UpdateTime = d.UpdateTime.Format(time.RFC3339)
	}
	OK(c, resp)
}

// CreateDept handles POST /system/dept.
func (h *DeptHandler) CreateDept(c *gin.Context) {
	var req deptReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "参数错误")
		return
	}
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	derr := h.svc.CreateDept(c.Request.Context(), userID, appsystem.DeptCreateRequest{
		Name:        req.Name,
		ParentID:    req.ParentID,
		Sort:        req.Sort,
		Status:      req.Status,
		Description: req.Description,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	OK(c, true)
}

// UpdateDept handles PUT /system/dept/:id.
func (h *DeptHandler) UpdateDept(c *gin.Context) {
	idStr := c.Param("id")
	idVal, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "无效的部门 ID")
		return
	}

	var req deptReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "参数错误")
		return
	}
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	derr := h.svc.UpdateDept(c.Request.Context(), userID, idVal, appsystem.DeptUpdateRequest{
		Name:        req.Name,
		ParentID:    req.ParentID,
		Sort:        req.Sort,
		Status:      req.Status,
		Description: req.Description,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// DeleteDept handles DELETE /system/dept with JSON body: { "ids": [1,2,3] }.
func (h *DeptHandler) DeleteDept(c *gin.Context) {
	var body struct {
		IDs []int64 `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.IDs) == 0 {
		Fail(c, "400", "参数错误")
		return
	}

	derr := h.svc.DeleteDept(c.Request.Context(), body.IDs)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// ExportDept handles GET /system/dept/export and streams a simple CSV file.
// 前端只需要一个可下载的文件，这里用 CSV 简化实现。
func (h *DeptHandler) ExportDept(c *gin.Context) {
	desc := strings.TrimSpace(c.Query("description"))
	statusStr := strings.TrimSpace(c.Query("status"))

	var status int64
	if statusStr != "" {
		if v, err := strconv.ParseInt(statusStr, 10, 64); err == nil && v > 0 {
			status = v
		}
	}

	list, derr := h.svc.ListDept(c.Request.Context(), desc, status)
	if derr != nil {
		Fail(c, "500", "导出部门失败")
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=\"dept_export.csv\"")

	writer := csv.NewWriter(c.Writer)
	_ = writer.Write([]string{"ID", "名称", "上级部门ID", "状态", "排序", "系统内置", "描述", "创建时间", "创建人", "修改时间", "修改人"})

	for _, row := range list {
		ut := ""
		if row.UpdateTime != nil && !row.UpdateTime.IsZero() {
			ut = row.UpdateTime.Format(time.RFC3339)
		}
		record := []string{
			strconv.FormatInt(row.ID, 10),
			row.Name,
			strconv.FormatInt(row.ParentID, 10),
			strconv.FormatInt(int64(row.Status), 10),
			strconv.FormatInt(int64(row.Sort), 10),
			strconv.FormatBool(row.IsSystem),
			row.Description,
			row.CreateTime.Format(time.RFC3339),
			row.CreateUserString,
			ut,
			row.UpdateUserString,
		}
		_ = writer.Write(record)
	}
	writer.Flush()
}
