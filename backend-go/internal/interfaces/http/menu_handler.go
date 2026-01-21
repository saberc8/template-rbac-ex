package http

import (
	"strconv"

	"github.com/gin-gonic/gin"

	apprbac "go-backend/internal/application/rbac"
	domainrbac "go-backend/internal/domain/rbac"
)

// MenuResp matches MenuResp in admin/src/apis/system/type.ts.
type MenuResp struct {
	ID               int64      `json:"id"`
	Title            string     `json:"title"`
	ParentID         int64      `json:"parentId"`
	Type             int16      `json:"type"`
	Path             string     `json:"path"`
	Name             string     `json:"name"`
	Component        string     `json:"component"`
	Redirect         string     `json:"redirect"`
	Icon             string     `json:"icon"`
	IsExternal       bool       `json:"isExternal"`
	IsCache          bool       `json:"isCache"`
	IsHidden         bool       `json:"isHidden"`
	Permission       string     `json:"permission"`
	Sort             int32      `json:"sort"`
	Status           int16      `json:"status"`
	CreateUserString string     `json:"createUserString"`
	CreateTime       string     `json:"createTime"`
	UpdateUserString string     `json:"updateUserString"`
	UpdateTime       string     `json:"updateTime"`
	Children         []MenuResp `json:"children"`
}

type menuReq struct {
	Type       int16  `json:"type"`
	Icon       string `json:"icon"`
	Title      string `json:"title"`
	Sort       int32  `json:"sort"`
	Permission string `json:"permission"`
	Path       string `json:"path"`
	Name       string `json:"name"`
	Component  string `json:"component"`
	Redirect   string `json:"redirect"`
	IsExternal *bool  `json:"isExternal"`
	IsCache    *bool  `json:"isCache"`
	IsHidden   *bool  `json:"isHidden"`
	ParentID   int64  `json:"parentId"`
	Status     int16  `json:"status"`
}

// MenuHandler provides /system/menu endpoints.
type MenuHandler struct {
	svc *apprbac.MenuService
}

func NewMenuHandler(svc *apprbac.MenuService) *MenuHandler {
	return &MenuHandler{svc: svc}
}

// RegisterMenuRoutes registers menu management routes.
func (h *MenuHandler) RegisterMenuRoutes(r *gin.Engine) {
	r.GET("/system/menu/tree", h.ListMenuTree)
	r.GET("/system/menu/:id", h.GetMenu)
	r.POST("/system/menu", h.CreateMenu)
	r.PUT("/system/menu/:id", h.UpdateMenu)
	r.DELETE("/system/menu", h.DeleteMenu)
	r.DELETE("/system/menu/cache", h.ClearMenuCache)
}

// ListMenuTree handles GET /system/menu/tree.
func (h *MenuHandler) ListMenuTree(c *gin.Context) {
	list, derr := h.svc.ListAll(c.Request.Context())
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	flat := make([]MenuResp, 0, len(list))
	for _, row := range list {
		item := toMenuResp(row)
		item.Children = []MenuResp{}
		flat = append(flat, item)
	}

	// Build tree by parentId.
	nodeMap := make(map[int64]*MenuResp, len(flat))
	var roots []MenuResp
	for i := range flat {
		nodeMap[flat[i].ID] = &flat[i]
	}
	// First, connect children using pointers only.
	for _, node := range nodeMap {
		if node.ParentID == 0 {
			continue
		}
		if parent, ok := nodeMap[node.ParentID]; ok {
			parent.Children = append(parent.Children, *node)
		}
	}
	// Then, copy roots (and orphans) out to value slice.
	for _, node := range nodeMap {
		if node.ParentID == 0 {
			roots = append(roots, *node)
		} else if _, ok := nodeMap[node.ParentID]; !ok {
			// Orphan node: treat as root.
			roots = append(roots, *node)
		}
	}

	OK(c, roots)
}

// GetMenu handles GET /system/menu/:id.
func (h *MenuHandler) GetMenu(c *gin.Context) {
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
	item := toMenuResp(*row)
	item.Children = []MenuResp{}
	OK(c, item)
}

// CreateMenu handles POST /system/menu.
func (h *MenuHandler) CreateMenu(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req menuReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}

	idVal, derr := h.svc.Create(c.Request.Context(), userID, apprbac.MenuSave{
		Type:       req.Type,
		Icon:       req.Icon,
		Title:      req.Title,
		Sort:       req.Sort,
		Permission: req.Permission,
		Path:       req.Path,
		Name:       req.Name,
		Component:  req.Component,
		Redirect:   req.Redirect,
		IsExternal: req.IsExternal,
		IsCache:    req.IsCache,
		IsHidden:   req.IsHidden,
		ParentID:   req.ParentID,
		Status:     req.Status,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, gin.H{"id": idVal})
}

// UpdateMenu handles PUT /system/menu/:id.
func (h *MenuHandler) UpdateMenu(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req menuReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	if derr := h.svc.Update(c.Request.Context(), userID, idVal, apprbac.MenuSave{
		Type:       req.Type,
		Icon:       req.Icon,
		Title:      req.Title,
		Sort:       req.Sort,
		Permission: req.Permission,
		Path:       req.Path,
		Name:       req.Name,
		Component:  req.Component,
		Redirect:   req.Redirect,
		IsExternal: req.IsExternal,
		IsCache:    req.IsCache,
		IsHidden:   req.IsHidden,
		ParentID:   req.ParentID,
		Status:     req.Status,
	}); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// DeleteMenu handles DELETE /system/menu.
func (h *MenuHandler) DeleteMenu(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	_ = userID

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

// ClearMenuCache handles DELETE /system/menu/cache.
// The Go backend does not use Redis-based menu cache yet, so this is a no-op.
func (h *MenuHandler) ClearMenuCache(c *gin.Context) {
	OK(c, true)
}

func toMenuResp(row domainrbac.MenuDetail) MenuResp {
	item := MenuResp{
		ID:               row.ID,
		Title:            row.Title,
		ParentID:         row.ParentID,
		Type:             int16(row.Type),
		Path:             row.Path,
		Name:             row.Name,
		Component:        row.Component,
		Redirect:         row.Redirect,
		Icon:             row.Icon,
		IsExternal:       row.IsExternal,
		IsCache:          row.IsCache,
		IsHidden:         row.IsHidden,
		Permission:       row.Permission,
		Sort:             row.Sort,
		Status:           row.Status,
		CreateUserString: row.CreateUserString,
		CreateTime:       formatTime(row.CreateTime),
		UpdateUserString: row.UpdateUserString,
	}
	if row.UpdateTime != nil && !row.UpdateTime.IsZero() {
		item.UpdateTime = formatTime(*row.UpdateTime)
	}
	return item
}
