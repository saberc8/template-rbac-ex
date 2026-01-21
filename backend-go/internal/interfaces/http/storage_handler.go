package http

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	appstorage "voc-go-backend/internal/application/storage"
	domainstorage "voc-go-backend/internal/domain/storage"
	"voc-go-backend/internal/infrastructure/security"
)

// StorageResp 对应前端 StorageResp 类型，用于存储配置列表与详情展示。
type StorageResp struct {
	ID               int64  `json:"id"`
	Name             string `json:"name"`
	Code             string `json:"code"`
	Type             int16  `json:"type"`
	AccessKey        string `json:"accessKey"`
	SecretKey        string `json:"secretKey"`
	Endpoint         string `json:"endpoint"`
	Region           string `json:"region"`
	BucketName       string `json:"bucketName"`
	Domain           string `json:"domain"`
	Description      string `json:"description"`
	IsDefault        bool   `json:"isDefault"`
	Sort             int32  `json:"sort"`
	Status           int16  `json:"status"`
	CreateUserString string `json:"createUserString"`
	CreateTime       string `json:"createTime"`
	UpdateUserString string `json:"updateUserString"`
	UpdateTime       string `json:"updateTime"`
}

// storageReq 用于接收新增/修改存储配置请求。
type storageReq struct {
	Name        string  `json:"name"`
	Code        string  `json:"code"`
	Type        int16   `json:"type"`
	AccessKey   string  `json:"accessKey"`
	SecretKey   *string `json:"secretKey"`
	Endpoint    string  `json:"endpoint"`
	Region      string  `json:"region"`
	BucketName  string  `json:"bucketName"`
	Domain      string  `json:"domain"`
	Description string  `json:"description"`
	IsDefault   *bool   `json:"isDefault"`
	Sort        int32   `json:"sort"`
	Status      int16   `json:"status"`
}

// StorageHandler 提供 /system/storage 相关接口。
type StorageHandler struct {
	svc          *appstorage.Service
	rsaDecryptor *security.RSADecryptor
}

func NewStorageHandler(svc *appstorage.Service, rsa *security.RSADecryptor) *StorageHandler {
	return &StorageHandler{
		svc:          svc,
		rsaDecryptor: rsa,
	}
}

// RegisterStorageRoutes 注册存储配置相关路由。
func (h *StorageHandler) RegisterStorageRoutes(r *gin.Engine) {
	r.GET("/system/storage/list", h.ListStorage)
	r.GET("/system/storage/:id", h.GetStorage)
	r.POST("/system/storage", h.CreateStorage)
	r.PUT("/system/storage/:id", h.UpdateStorage)
	r.DELETE("/system/storage", h.DeleteStorage)
	r.PUT("/system/storage/:id/status", h.UpdateStorageStatus)
	r.PUT("/system/storage/:id/default", h.SetDefaultStorage)
}

// decryptSecretKey 使用后端 RSA 私钥对前端加密的密钥进行解密，并做长度校验。
// 如果 encrypted 为空或 nil，则返回 oldVal（用于更新场景保持原值）。
func (h *StorageHandler) decryptSecretKey(encrypted *string, oldVal string) (string, error) {
	if encrypted == nil {
		return oldVal, nil
	}
	val := strings.TrimSpace(*encrypted)
	if val == "" {
		return "", nil
	}
	if h.rsaDecryptor == nil {
		return "", fmt.Errorf("存储密钥解密器未初始化")
	}
	plain, err := h.rsaDecryptor.DecryptBase64(val)
	if err != nil {
		return "", fmt.Errorf("私有密钥解密失败")
	}
	if len(plain) > 255 {
		return "", fmt.Errorf("私有密钥长度不能超过 255 个字符")
	}
	return plain, nil
}

// ListStorage 处理 GET /system/storage/list，支持按描述与类型筛选。
func (h *StorageHandler) ListStorage(c *gin.Context) {
	description := strings.TrimSpace(c.Query("description"))
	typeStr := strings.TrimSpace(c.Query("type"))

	var storageType int64
	if typeStr != "" {
		storageType, _ = strconv.ParseInt(typeStr, 10, 64)
	}

	list, derr := h.svc.ListStorage(c.Request.Context(), description, storageType)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	out := make([]StorageResp, 0, len(list))
	for _, item := range list {
		out = append(out, toStorageResp(item, false))
	}
	OK(c, out)
}

// GetStorage 处理 GET /system/storage/:id。
func (h *StorageHandler) GetStorage(c *gin.Context) {
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	item, derr := h.svc.GetStorage(c.Request.Context(), idVal)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, toStorageResp(*item, true))
}

// CreateStorage 处理 POST /system/storage。
func (h *StorageHandler) CreateStorage(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req storageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Code = strings.TrimSpace(req.Code)
	req.BucketName = strings.TrimSpace(req.BucketName)
	req.Domain = strings.TrimSpace(req.Domain)
	req.Endpoint = strings.TrimSpace(req.Endpoint)
	req.Region = strings.TrimSpace(req.Region)

	if req.Name == "" || req.Code == "" {
		Fail(c, "400", "名称和编码不能为空")
		return
	}
	if req.Type == 0 {
		req.Type = 1
	}
	if req.Sort <= 0 {
		req.Sort = 999
	}
	if req.Status == 0 {
		req.Status = 1
	}

	// 编码唯一性校验

	// 解密 SecretKey（仅对象存储需要，解密失败按 400 返回）
	secretVal := ""
	if req.Type == 2 {
		plain, err := h.decryptSecretKey(req.SecretKey, "")
		if err != nil {
			Fail(c, "400", err.Error())
			return
		}
		secretVal = plain
	}
	isDefault := false
	if req.IsDefault != nil {
		isDefault = *req.IsDefault
	}
	idVal, derr := h.svc.CreateStorage(c.Request.Context(), userID, appstorage.StorageCreateRequest{
		Name:        req.Name,
		Code:        req.Code,
		Type:        req.Type,
		AccessKey:   req.AccessKey,
		SecretKey:   secretVal,
		Endpoint:    req.Endpoint,
		Region:      req.Region,
		BucketName:  req.BucketName,
		Domain:      req.Domain,
		Description: req.Description,
		IsDefault:   &isDefault,
		Sort:        req.Sort,
		Status:      req.Status,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, gin.H{"id": idVal})
}

// UpdateStorage 处理 PUT /system/storage/:id。
func (h *StorageHandler) UpdateStorage(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req storageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.BucketName = strings.TrimSpace(req.BucketName)
	req.Domain = strings.TrimSpace(req.Domain)
	req.Endpoint = strings.TrimSpace(req.Endpoint)
	req.Region = strings.TrimSpace(req.Region)

	if req.Name == "" {
		Fail(c, "400", "名称不能为空")
		return
	}
	if req.Sort <= 0 {
		req.Sort = 999
	}
	if req.Status == 0 {
		req.Status = 1
	}

	var secretPtr *string
	if req.SecretKey != nil {
		secretVal := strings.TrimSpace(*req.SecretKey)
		if req.Type == 2 {
			plain, err := h.decryptSecretKey(req.SecretKey, "")
			if err != nil {
				Fail(c, "400", err.Error())
				return
			}
			secretVal = plain
		}
		secretPtr = &secretVal
	}

	derr := h.svc.UpdateStorage(c.Request.Context(), userID, idVal, appstorage.StorageUpdateRequest{
		Name:        req.Name,
		Code:        req.Code,
		Type:        req.Type,
		AccessKey:   req.AccessKey,
		SecretKey:   secretPtr,
		Endpoint:    req.Endpoint,
		Region:      req.Region,
		BucketName:  req.BucketName,
		Domain:      req.Domain,
		Description: req.Description,
		IsDefault:   req.IsDefault,
		Sort:        req.Sort,
		Status:      req.Status,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// DeleteStorage 处理 DELETE /system/storage。
func (h *StorageHandler) DeleteStorage(c *gin.Context) {
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
	if derr := h.svc.DeleteStorage(c.Request.Context(), req.IDs); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// UpdateStorageStatus 处理 PUT /system/storage/:id/status，仅修改启用状态。
func (h *StorageHandler) UpdateStorageStatus(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}

	var req struct {
		Status int16 `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	if req.Status != 1 && req.Status != 2 {
		Fail(c, "400", "状态参数不正确")
		return
	}
	if derr := h.svc.UpdateStorageStatus(c.Request.Context(), userID, idVal, req.Status); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// SetDefaultStorage 处理 PUT /system/storage/:id/default，将指定存储设置为默认。
func (h *StorageHandler) SetDefaultStorage(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}
	if derr := h.svc.SetDefaultStorage(c.Request.Context(), userID, idVal); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

func toStorageResp(item domainstorage.StorageDetail, maskSecret bool) StorageResp {
	resp := StorageResp{
		ID:               item.ID,
		Name:             item.Name,
		Code:             item.Code,
		Type:             item.Type,
		AccessKey:        item.AccessKey,
		SecretKey:        item.SecretKey,
		Endpoint:         item.Endpoint,
		Region:           item.Region,
		BucketName:       item.BucketName,
		Domain:           item.Domain,
		Description:      item.Description,
		IsDefault:        item.IsDefault,
		Sort:             item.Sort,
		Status:           item.Status,
		CreateUserString: item.CreateUserString,
		UpdateUserString: item.UpdateUserString,
		CreateTime:       formatTime(item.CreateTime),
	}
	if item.UpdateTime != nil && !item.UpdateTime.IsZero() {
		resp.UpdateTime = formatTime(*item.UpdateTime)
	}
	if maskSecret {
		if strings.TrimSpace(resp.SecretKey) != "" {
			resp.SecretKey = "******"
		}
	} else {
		resp.SecretKey = ""
	}
	return resp
}
