package http

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	appclient "voc-go-backend/internal/application/client"
	domainclient "voc-go-backend/internal/domain/client"
)

// ClientResp 对应前端 ClientResp，用于列表展示。
type ClientResp struct {
	ID               int64    `json:"id"`
	ClientID         string   `json:"clientId"`
	ClientType       string   `json:"clientType"`
	AuthType         []string `json:"authType"`
	ActiveTimeout    int64    `json:"activeTimeout"`
	Timeout          int64    `json:"timeout"`
	Status           int16    `json:"status"`
	CreateUser       string   `json:"createUser"`
	CreateTime       string   `json:"createTime"`
	UpdateUser       string   `json:"updateUser"`
	UpdateTime       string   `json:"updateTime"`
	CreateUserString string   `json:"createUserString"`
	UpdateUserString string   `json:"updateUserString"`
}

// ClientDetailResp 与前端 ClientDetailResp 对应。
type ClientDetailResp = ClientResp

// clientReq 用于新增/修改客户端配置。
type clientReq struct {
	ClientType    string   `json:"clientType"`
	AuthType      []string `json:"authType"`
	ActiveTimeout int64    `json:"activeTimeout"`
	Timeout       int64    `json:"timeout"`
	Status        int16    `json:"status"`
}

// ClientHandler 提供 /system/client 相关接口。
type ClientHandler struct {
	svc *appclient.Service
}

func NewClientHandler(svc *appclient.Service) *ClientHandler {
	return &ClientHandler{
		svc: svc,
	}
}

// RegisterClientRoutes 注册客户端配置路由。
func (h *ClientHandler) RegisterClientRoutes(r *gin.Engine) {
	r.GET("/system/client", h.ListClientPage)
	r.GET("/system/client/:id", h.GetClient)
	r.POST("/system/client", h.CreateClient)
	r.PUT("/system/client/:id", h.UpdateClient)
	r.DELETE("/system/client", h.DeleteClient)
}

func parsePositiveQueryInt(c *gin.Context, key string, def int) (int, bool) {
	raw, present := c.GetQuery(key)
	if !present {
		return def, true
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return def, true
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return 0, false
	}
	return v, true
}

func normalizeNonEmptyUnique(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// ListClientPage 处理 GET /system/client（分页查询客户端）。
func (h *ClientHandler) ListClientPage(c *gin.Context) {
	page, ok := parsePositiveQueryInt(c, "page", 1)
	if !ok {
		Fail(c, "400", "page 参数不正确")
		return
	}
	size, ok := parsePositiveQueryInt(c, "size", 10)
	if !ok {
		Fail(c, "400", "size 参数不正确")
		return
	}

	clientType := strings.TrimSpace(c.Query("clientType"))
	authTypes := normalizeNonEmptyUnique(c.QueryArray("authType"))

	var (
		hasStatus    bool
		statusFilter int64
	)
	if raw, present := c.GetQuery("status"); present {
		raw = strings.TrimSpace(raw)
		if raw != "" {
			v, err := strconv.ParseInt(raw, 10, 64)
			if err != nil || v < 0 {
				Fail(c, "400", "status 参数不正确")
				return
			}
			hasStatus = true
			statusFilter = v
		}
	}

	var statusPtr *int16
	if hasStatus {
		v := int16(statusFilter)
		statusPtr = &v
	}

	res, derr := h.svc.Page(c.Request.Context(), domainclient.PageQuery{
		Page:       page,
		Size:       size,
		ClientType: clientType,
		AuthType:   authTypes,
		Status:     statusPtr,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	list := make([]ClientResp, 0, len(res.List))
	for _, item := range res.List {
		resp := ClientResp{
			ID:               item.ID,
			ClientID:         item.ClientID,
			ClientType:       item.ClientType,
			AuthType:         item.AuthType,
			ActiveTimeout:    item.ActiveTimeout,
			Timeout:          item.Timeout,
			Status:           item.Status,
			CreateUser:       item.CreateUserString,
			UpdateUser:       item.UpdateUserString,
			CreateUserString: item.CreateUserString,
			UpdateUserString: item.UpdateUserString,
			CreateTime:       formatTime(item.CreateTime),
		}
		if item.UpdateTime != nil && !item.UpdateTime.IsZero() {
			resp.UpdateTime = formatTime(*item.UpdateTime)
		}
		list = append(list, resp)
	}
	OK(c, PageResult[ClientResp]{List: list, Total: res.Total})
}

// GetClient 处理 GET /system/client/:id。
func (h *ClientHandler) GetClient(c *gin.Context) {
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	item, derr := h.svc.Get(c.Request.Context(), idVal)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	resp := ClientDetailResp{
		ID:               item.ID,
		ClientID:         item.ClientID,
		ClientType:       item.ClientType,
		AuthType:         item.AuthType,
		ActiveTimeout:    item.ActiveTimeout,
		Timeout:          item.Timeout,
		Status:           item.Status,
		CreateUser:       item.CreateUserString,
		UpdateUser:       item.UpdateUserString,
		CreateUserString: item.CreateUserString,
		UpdateUserString: item.UpdateUserString,
		CreateTime:       formatTime(item.CreateTime),
	}
	if item.UpdateTime != nil && !item.UpdateTime.IsZero() {
		resp.UpdateTime = formatTime(*item.UpdateTime)
	}
	OK(c, resp)
}

// CreateClient 处理 POST /system/client。
func (h *ClientHandler) CreateClient(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req clientReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	req.ClientType = strings.TrimSpace(req.ClientType)
	if req.ClientType == "" || len(req.AuthType) == 0 {
		Fail(c, "400", "客户端类型和认证类型不能为空")
		return
	}
	if req.ActiveTimeout == 0 {
		req.ActiveTimeout = 1800
	}
	if req.Timeout == 0 {
		req.Timeout = 86400
	}
	if req.Status == 0 {
		req.Status = 1
	}
	idVal, derr := h.svc.Create(c.Request.Context(), userID, appclient.CreateRequest{
		ClientType:    req.ClientType,
		AuthType:      req.AuthType,
		ActiveTimeout: req.ActiveTimeout,
		Timeout:       req.Timeout,
		Status:        req.Status,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, gin.H{"id": idVal})
}

// UpdateClient 处理 PUT /system/client/:id。
func (h *ClientHandler) UpdateClient(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req clientReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	req.ClientType = strings.TrimSpace(req.ClientType)
	if req.ClientType == "" || len(req.AuthType) == 0 {
		Fail(c, "400", "客户端类型和认证类型不能为空")
		return
	}
	if req.Status == 0 {
		req.Status = 1
	}
	if derr := h.svc.Update(c.Request.Context(), userID, idVal, appclient.UpdateRequest{
		ClientType:    req.ClientType,
		AuthType:      req.AuthType,
		ActiveTimeout: req.ActiveTimeout,
		Timeout:       req.Timeout,
		Status:        req.Status,
	}); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// DeleteClient 处理 DELETE /system/client。
func (h *ClientHandler) DeleteClient(c *gin.Context) {
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
