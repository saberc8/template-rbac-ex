package http

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	appdict "voc-go-backend/internal/application/dict"
)

// DictResp matches admin/src/apis/system/type.ts -> DictResp.
type DictResp struct {
	ID               int64  `json:"id"`
	Name             string `json:"name"`
	Code             string `json:"code"`
	IsSystem         bool   `json:"isSystem"`
	Description      string `json:"description"`
	CreateUserString string `json:"createUserString"`
	CreateTime       string `json:"createTime"`
	UpdateUserString string `json:"updateUserString"`
	UpdateTime       string `json:"updateTime"`
}

// DictItemResp matches DictItemResp type on the front-end.
type DictItemResp struct {
	ID               int64  `json:"id"`
	Label            string `json:"label"`
	Value            string `json:"value"`
	Color            string `json:"color"`
	Sort             int32  `json:"sort"`
	Description      string `json:"description"`
	Status           int16  `json:"status"`
	DictID           int64  `json:"dictId"`
	CreateUserString string `json:"createUserString"`
	CreateTime       string `json:"createTime"`
	UpdateUserString string `json:"updateUserString"`
	UpdateTime       string `json:"updateTime"`
}

type dictReq struct {
	Name        string `json:"name"`
	Code        string `json:"code"`
	Description string `json:"description"`
}

type dictItemReq struct {
	Label       string `json:"label"`
	Value       string `json:"value"`
	Color       string `json:"color"`
	Sort        int32  `json:"sort"`
	Description string `json:"description"`
	Status      int16  `json:"status"`
	DictID      int64  `json:"dictId"` // only used on create
}

// DictHandler provides /system/dict and /system/dict/item endpoints.
// It validates HTTP input and delegates business logic to application services.
type DictHandler struct {
	svc *appdict.Service
}

func NewDictHandler(svc *appdict.Service) *DictHandler {
	return &DictHandler{svc: svc}
}

// RegisterDictRoutes registers dictionary management routes.
func (h *DictHandler) RegisterDictRoutes(r *gin.Engine) {
	// 字典本身
	r.GET("/system/dict/list", h.ListDict)
	r.GET("/system/dict/:id", h.GetDict)
	r.POST("/system/dict", h.CreateDict)
	r.PUT("/system/dict/:id", h.UpdateDict)
	r.DELETE("/system/dict", h.DeleteDict)
	r.DELETE("/system/dict/cache/:code", h.ClearDictCache)

	// 字典项
	r.GET("/system/dict/item", h.ListDictItem)
	r.GET("/system/dict/item/:id", h.GetDictItem)
	r.POST("/system/dict/item", h.CreateDictItem)
	r.PUT("/system/dict/item/:id", h.UpdateDictItem)
	r.DELETE("/system/dict/item", h.DeleteDictItem)
}

func formatTimePtr(t *time.Time) string {
	if t == nil || t.IsZero() {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}

// currentUserID parses token and returns userID, or 0 if unauthorized (and writes 401).
// ListDict handles GET /system/dict/list
func (h *DictHandler) ListDict(c *gin.Context) {
	description := strings.TrimSpace(c.Query("description"))
	list, derr := h.svc.ListDict(c.Request.Context(), description)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	out := make([]DictResp, 0, len(list))
	for _, d := range list {
		var updateTime string
		if d.UpdateTime != nil {
			updateTime = formatTimePtr(d.UpdateTime)
		}
		out = append(out, DictResp{
			ID:               d.ID,
			Name:             d.Name,
			Code:             d.Code,
			IsSystem:         d.IsSystem,
			Description:      d.Description,
			CreateUserString: d.CreateUserString,
			CreateTime:       formatTime(d.CreateTime),
			UpdateUserString: d.UpdateUserString,
			UpdateTime:       updateTime,
		})
	}
	OK(c, out)
}

// GetDict handles GET /system/dict/:id
func (h *DictHandler) GetDict(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}
	d, derr := h.svc.GetDict(c.Request.Context(), id)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	var updateTime string
	if d.UpdateTime != nil {
		updateTime = formatTimePtr(d.UpdateTime)
	}
	OK(c, DictResp{
		ID:               d.ID,
		Name:             d.Name,
		Code:             d.Code,
		IsSystem:         d.IsSystem,
		Description:      d.Description,
		CreateUserString: d.CreateUserString,
		CreateTime:       formatTime(d.CreateTime),
		UpdateUserString: d.UpdateUserString,
		UpdateTime:       updateTime,
	})
}

// CreateDict handles POST /system/dict
func (h *DictHandler) CreateDict(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	var req dictReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	idVal, derr := h.svc.CreateDict(c.Request.Context(), userID, appdict.DictCreateRequest{
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, gin.H{"id": idVal})
}

// UpdateDict handles PUT /system/dict/:id
func (h *DictHandler) UpdateDict(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req dictReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	derr := h.svc.UpdateDict(c.Request.Context(), userID, idVal, appdict.DictUpdateRequest{
		Name:        req.Name,
		Description: req.Description,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

type idsRequest struct {
	IDs []int64 `json:"ids"`
}

// DeleteDict handles DELETE /system/dict
func (h *DictHandler) DeleteDict(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req idsRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		Fail(c, "400", "ID 列表不能为空")
		return
	}
	derr := h.svc.DeleteDict(c.Request.Context(), userID, req.IDs)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// ClearDictCache handles DELETE /system/dict/cache/:code
// The current Go backend does not use Redis cache yet, so this is a no-op.
func (h *DictHandler) ClearDictCache(c *gin.Context) {
	// code := c.Param("code") // kept for future cache integration
	OK(c, true)
}

// ListDictItem handles GET /system/dict/item (分页查询字典项)
func (h *DictHandler) ListDictItem(c *gin.Context) {
	dictIDStr := strings.TrimSpace(c.Query("dictId"))

	page, _ := strconv.Atoi(c.Query("page"))
	size, _ := strconv.Atoi(c.Query("size"))
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 10
	}
	description := strings.TrimSpace(c.Query("description"))
	statusStr := strings.TrimSpace(c.Query("status"))
	var dictID *int64
	if dictIDStr != "" {
		val, parseErr := strconv.ParseInt(dictIDStr, 10, 64)
		if parseErr != nil || val <= 0 {
			Fail(c, "400", "字典 ID 不正确")
			return
		}
		dictID = &val
	}
	var status *int64
	if statusStr != "" {
		val, _ := strconv.ParseInt(statusStr, 10, 64)
		if val != 0 {
			status = &val
		}
	}

	items, total, derr := h.svc.PageDictItem(c.Request.Context(), appdict.DictItemPageQuery{
		DictID:      dictID,
		Page:        page,
		Size:        size,
		Description: description,
		Status:      status,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	out := make([]DictItemResp, 0, len(items))
	for _, it := range items {
		var updateTime string
		if it.UpdateTime != nil {
			updateTime = formatTimePtr(it.UpdateTime)
		}
		out = append(out, DictItemResp{
			ID:               it.ID,
			Label:            it.Label,
			Value:            it.Value,
			Color:            it.Color,
			Sort:             it.Sort,
			Description:      it.Description,
			Status:           it.Status,
			DictID:           it.DictID,
			CreateUserString: it.CreateUserString,
			CreateTime:       formatTime(it.CreateTime),
			UpdateUserString: it.UpdateUserString,
			UpdateTime:       updateTime,
		})
	}
	OK(c, PageResult[DictItemResp]{List: out, Total: total})
}

// GetDictItem handles GET /system/dict/item/:id
func (h *DictHandler) GetDictItem(c *gin.Context) {
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}
	item, derr := h.svc.GetDictItem(c.Request.Context(), idVal)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	var updateTime string
	if item.UpdateTime != nil {
		updateTime = formatTimePtr(item.UpdateTime)
	}
	OK(c, DictItemResp{
		ID:               item.ID,
		Label:            item.Label,
		Value:            item.Value,
		Color:            item.Color,
		Sort:             item.Sort,
		Description:      item.Description,
		Status:           item.Status,
		DictID:           item.DictID,
		CreateUserString: item.CreateUserString,
		CreateTime:       formatTime(item.CreateTime),
		UpdateUserString: item.UpdateUserString,
		UpdateTime:       updateTime,
	})
}

// CreateDictItem handles POST /system/dict/item
func (h *DictHandler) CreateDictItem(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req dictItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	idVal, derr := h.svc.CreateDictItem(c.Request.Context(), userID, appdict.DictItemCreateRequest{
		Label:       req.Label,
		Value:       req.Value,
		Color:       req.Color,
		Sort:        req.Sort,
		Description: req.Description,
		Status:      req.Status,
		DictID:      req.DictID,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, gin.H{"id": idVal})
}

// UpdateDictItem handles PUT /system/dict/item/:id
func (h *DictHandler) UpdateDictItem(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req dictItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	derr := h.svc.UpdateDictItem(c.Request.Context(), userID, idVal, appdict.DictItemUpdateRequest{
		Label:       req.Label,
		Value:       req.Value,
		Color:       req.Color,
		Sort:        req.Sort,
		Description: req.Description,
		Status:      req.Status,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// DeleteDictItem handles DELETE /system/dict/item
func (h *DictHandler) DeleteDictItem(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req idsRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		Fail(c, "400", "ID 列表不能为空")
		return
	}
	derr := h.svc.DeleteDictItem(c.Request.Context(), userID, req.IDs)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}
