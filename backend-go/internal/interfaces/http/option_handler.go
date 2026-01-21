package http

import (
	"strings"

	"github.com/gin-gonic/gin"

	appsystem "voc-go-backend/internal/application/system"
)

// OptionResp matches OptionResp in admin/src/apis/system/type.ts.
type OptionResp struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Code        string `json:"code"`
	Value       string `json:"value"`
	Description string `json:"description"`
}

// OptionQuery represents query params for listing options.
type OptionQuery struct {
	Code     []string
	Category string
}

// OptionHandler exposes /system/option endpoints used by /system/config* tabs.
type OptionHandler struct {
	svc *appsystem.Service
}

func NewOptionHandler(svc *appsystem.Service) *OptionHandler {
	return &OptionHandler{
		svc: svc,
	}
}

// RegisterOptionRoutes registers /system/option endpoints.
func (h *OptionHandler) RegisterOptionRoutes(r *gin.Engine) {
	r.GET("/system/option", h.ListOption)
	r.PUT("/system/option", h.UpdateOption)
	r.PATCH("/system/option/value", h.ResetOptionValue)
}

// ListOption handles GET /system/option.
func (h *OptionHandler) ListOption(c *gin.Context) {
	var query OptionQuery
	if codes, ok := c.GetQueryArray("code"); ok && len(codes) > 0 {
		// support both repeated & comma-joined form
		for _, raw := range codes {
			parts := strings.Split(raw, ",")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					query.Code = append(query.Code, p)
				}
			}
		}
	}
	query.Category = strings.TrimSpace(c.Query("category"))

	list, derr := h.svc.ListOption(c.Request.Context(), query.Code, query.Category)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	out := make([]OptionResp, 0, len(list))
	for _, o := range list {
		out = append(out, OptionResp{
			ID:          o.ID,
			Name:        o.Name,
			Code:        o.Code,
			Value:       o.Value,
			Description: o.Description,
		})
	}
	OK(c, out)
}

// UpdateOption handles PUT /system/option (bulk update).
func (h *OptionHandler) UpdateOption(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	// 这里 Value 使用 interface{}，以兼容前端传递字符串、数字、布尔等多种类型，
	// 避免 Go 的 JSON 反序列化因类型不匹配而报错（例如 value 为 0 时不能直接解到 string）。
	var body []struct {
		ID    int64       `json:"id"`
		Code  string      `json:"code"`
		Value interface{} `json:"value"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body) == 0 {
		Fail(c, "400", "请求参数不正确")
		return
	}
	reqs := make([]appsystem.OptionUpdateRequest, 0, len(body))
	for _, o := range body {
		reqs = append(reqs, appsystem.OptionUpdateRequest{
			ID:    o.ID,
			Code:  o.Code,
			Value: o.Value,
		})
	}
	if derr := h.svc.UpdateOption(c.Request.Context(), userID, reqs); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// ResetOptionValue handles PATCH /system/option/value to reset to defaults.
func (h *OptionHandler) ResetOptionValue(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	_ = userID // reserved for audit usage

	var body struct {
		Code     []string `json:"code"`
		Category string   `json:"category"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}

	if len(body.Code) == 0 && strings.TrimSpace(body.Category) == "" {
		Fail(c, "400", "键列表或类别不能为空")
		return
	}

	if derr := h.svc.ResetOptionValue(c.Request.Context(), appsystem.OptionResetRequest{
		Codes:    body.Code,
		Category: body.Category,
	}); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}
