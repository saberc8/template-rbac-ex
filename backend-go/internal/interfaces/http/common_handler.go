package http

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	appdict "voc-go-backend/internal/application/dict"
	apprbac "voc-go-backend/internal/application/rbac"
	appsystem "voc-go-backend/internal/application/system"
	appuser "voc-go-backend/internal/application/user"
)

// LabelValue represents a simple label/value pair for dictionaries.
type LabelValue struct {
	Label string `json:"label"`
	Value any    `json:"value"`
	Extra string `json:"extra,omitempty"`
}

// DeptTreeNode matches the TreeNodeData structure used by Arco Tree/TreeSelect.
type DeptTreeNode struct {
	Key      int64          `json:"key"`
	Title    string         `json:"title"`
	Disabled bool           `json:"disabled"`
	Children []DeptTreeNode `json:"children,omitempty"`
}

// MenuTreeNode is a simplified menu tree node for common menu trees.
type MenuTreeNode struct {
	Key      int64          `json:"key"`
	Title    string         `json:"title"`
	Disabled bool           `json:"disabled"`
	Children []MenuTreeNode `json:"children,omitempty"`
}

// CommonHandler exposes /common related endpoints.
type CommonHandler struct {
	systemSvc *appsystem.Service
	menuSvc   *apprbac.MenuService
	roleSvc   *apprbac.RoleService
	dictSvc   *appdict.Service
	userSvc   *appuser.AdminService
}

func NewCommonHandler(
	systemSvc *appsystem.Service,
	menuSvc *apprbac.MenuService,
	roleSvc *apprbac.RoleService,
	dictSvc *appdict.Service,
	userSvc *appuser.AdminService,
) *CommonHandler {
	return &CommonHandler{
		systemSvc: systemSvc,
		menuSvc:   menuSvc,
		roleSvc:   roleSvc,
		dictSvc:   dictSvc,
		userSvc:   userSvc,
	}
}

// RegisterCommonRoutes registers /common endpoints.
func (h *CommonHandler) RegisterCommonRoutes(r *gin.Engine) {
	r.GET("/common/dict/option/site", h.ListSiteOptions)
	r.GET("/common/tree/menu", h.ListMenuTree)
	r.GET("/common/tree/dept", h.ListDeptTree)
	r.GET("/common/dict/user", h.ListUserDict)
	r.GET("/common/dict/role", h.ListRoleDict)
	r.GET("/common/dict/:code", h.ListDictByCode)
}

// ListSiteOptions 返回基础网站配置字典数据（用于前端初始化站点标题、图标等）。
// 数据来源于 sys_option 表的 SITE 类别，优先使用当前 value，其次 default_value。
func (h *CommonHandler) ListSiteOptions(c *gin.Context) {
	list, derr := h.systemSvc.ListOption(c.Request.Context(), nil, "SITE")
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	out := make([]LabelValue, 0, len(list))
	for _, it := range list {
		out = append(out, LabelValue{
			Label: it.Code,
			Value: it.Value,
		})
	}
	OK(c, out)
}

// ListMenuTree handles GET /common/tree/menu and returns a menu tree
// compatible with the front-end TreeNodeData definition.
func (h *CommonHandler) ListMenuTree(c *gin.Context) {
	list, derr := h.menuSvc.ListAll(c.Request.Context())
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	filtered := make([]MenuTreeNode, 0, len(list))
	type menuRow struct {
		id       int64
		title    string
		parentID int64
		status   int16
	}
	rows := make([]menuRow, 0, len(list))
	for _, m := range list {
		if m.Type != 1 && m.Type != 2 {
			continue
		}
		rows = append(rows, menuRow{
			id:       m.ID,
			title:    m.Title,
			parentID: m.ParentID,
			status:   m.Status,
		})
	}
	if len(rows) == 0 {
		OK(c, []MenuTreeNode{})
		return
	}

	nodeMap := make(map[int64]*MenuTreeNode, len(rows))
	for _, m := range rows {
		nodeMap[m.id] = &MenuTreeNode{
			Key:      m.id,
			Title:    m.title,
			Disabled: m.status != 1,
		}
	}

	var roots []*MenuTreeNode
	for _, m := range rows {
		node := nodeMap[m.id]
		if m.parentID == 0 {
			roots = append(roots, node)
			continue
		}
		parent, ok := nodeMap[m.parentID]
		if !ok {
			roots = append(roots, node)
			continue
		}
		parent.Children = append(parent.Children, *node)
	}

	for _, n := range roots {
		filtered = append(filtered, *n)
	}
	OK(c, filtered)
}

// ListDeptTree handles GET /common/tree/dept and returns a department tree
// compatible with the front-end TreeNodeData definition.
func (h *CommonHandler) ListDeptTree(c *gin.Context) {
	flat, derr := h.systemSvc.ListDept(c.Request.Context(), "", 0)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	if len(flat) == 0 {
		OK(c, []DeptTreeNode{})
		return
	}

	nodeMap := make(map[int64]*DeptTreeNode, len(flat))
	for _, d := range flat {
		nodeMap[d.ID] = &DeptTreeNode{
			Key:      d.ID,
			Title:    d.Name,
			Disabled: false,
		}
	}

	var roots []*DeptTreeNode
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

	result := make([]DeptTreeNode, 0, len(roots))
	for _, n := range roots {
		result = append(result, *n)
	}
	OK(c, result)
}

// ListUserDict handles GET /common/dict/user and returns a simple user dictionary.
// label: nickname (fallback to username)
// value: user ID (number)
// extra: username
func (h *CommonHandler) ListUserDict(c *gin.Context) {
	statusStr := strings.TrimSpace(c.Query("status"))
	var statusFilter *int64
	if statusStr != "" {
		if s, err := strconv.ParseInt(statusStr, 10, 64); err == nil && s > 0 {
			statusFilter = &s
		}
	}

	list, derr := h.userSvc.ListUserDict(c.Request.Context(), statusFilter)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	out := make([]LabelValue, 0, len(list))
	for _, it := range list {
		out = append(out, LabelValue{
			Label: it.Nickname,
			Value: it.ID,
			Extra: it.Username,
		})
	}
	OK(c, out)
}

// ListRoleDict handles GET /common/dict/role and returns a simple role dictionary.
// label: role name
// value: role ID (number)
// extra: role code
func (h *CommonHandler) ListRoleDict(c *gin.Context) {
	list, derr := h.roleSvc.List(c.Request.Context(), "")
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	out := make([]LabelValue, 0, len(list))
	for _, it := range list {
		out = append(out, LabelValue{
			Label: it.Name,
			Value: it.ID,
			Extra: it.Code,
		})
	}
	OK(c, out)
}

// ListDictByCode handles GET /common/dict/{code} and returns dictionary items
// defined in sys_dict/sys_dict_item, compatible with the Java implementation.
// extra: color
func (h *CommonHandler) ListDictByCode(c *gin.Context) {
	code := strings.TrimSpace(c.Param("code"))
	if code == "" {
		OK(c, []LabelValue{})
		return
	}
	items, derr := h.dictSvc.ListActiveItemsByCode(c.Request.Context(), code)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	list := make([]LabelValue, 0, len(items))
	for _, it := range items {
		list = append(list, LabelValue{
			Label: it.Label,
			Value: it.Value,
			Extra: it.Color,
		})
	}
	OK(c, list)
}
