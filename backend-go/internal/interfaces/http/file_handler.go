package http

import (
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	appstorage "voc-go-backend/internal/application/storage"
	domainstorage "voc-go-backend/internal/domain/storage"
)

// FileItem matches the front-end FileItem type in admin/src/apis/system/type.ts.
type FileItem struct {
	ID               int64  `json:"id"`
	Name             string `json:"name"`
	OriginalName     string `json:"originalName"`
	Size             *int64 `json:"size"`
	URL              string `json:"url"`
	ParentPath       string `json:"parentPath"`
	Path             string `json:"path"`
	Sha256           string `json:"sha256"`
	ContentType      string `json:"contentType"`
	Metadata         string `json:"metadata"`
	ThumbnailSize    *int64 `json:"thumbnailSize"`
	ThumbnailName    string `json:"thumbnailName"`
	ThumbnailMeta    string `json:"thumbnailMetadata"`
	ThumbnailURL     string `json:"thumbnailUrl"`
	Extension        string `json:"extension"`
	Type             int16  `json:"type"`
	StorageID        int64  `json:"storageId"`
	StorageName      string `json:"storageName"`
	CreateUserString string `json:"createUserString"`
	CreateTime       string `json:"createTime"`
	UpdateUserString string `json:"updateUserString"`
	UpdateTime       string `json:"updateTime"`
}

// FileStatisticsResp represents aggregated file statistics.
type FileStatisticsResp struct {
	Type   int16                `json:"type"`
	Size   int64                `json:"size"`
	Number int64                `json:"number"`
	Data   []FileStatisticsResp `json:"data,omitempty"`
}

// FileDirCalcSizeResp represents directory size response.
type FileDirCalcSizeResp struct {
	Size int64 `json:"size"`
}

// FileUploadResp matches Java's FileUploadResp.
type FileUploadResp struct {
	ID       string            `json:"id"`
	URL      string            `json:"url"`
	ThumbURL string            `json:"thUrl"`
	Metadata map[string]string `json:"metadata"`
}

// fileHandler implements /system/file and /common/file APIs.
type FileHandler struct {
	svc *appstorage.FileService
}

func NewFileHandler(svc *appstorage.FileService) *FileHandler {
	return &FileHandler{
		svc: svc,
	}
}

// RegisterFileRoutes registers all file-related routes.
func (h *FileHandler) RegisterFileRoutes(r *gin.Engine) {
	// System file management
	r.GET("/system/file", h.ListFile)
	r.POST("/system/file/upload", h.UploadFile)
	r.POST("/system/file/dir", h.CreateDir)
	r.GET("/system/file/dir/:id/size", h.CalcDirSize)
	r.GET("/system/file/statistics", h.Statistics)
	r.GET("/system/file/check", h.CheckFile)
	r.PUT("/system/file/:id", h.UpdateFile)
	r.DELETE("/system/file", h.DeleteFile)

	// Common upload (avatar, editor, etc.)
	r.POST("/common/file", h.UploadFile)
}

// storageType 常量定义，与 Java StorageTypeEnum 一致：1=LOCAL，2=OSS(MinIO等)。
const (
	storageTypeLocal int16 = 1
	storageTypeOSS   int16 = 2
)

// fileBaseURLPrefix returns the URL prefix used for local file URLs, e.g. "/file".
func fileBaseURLPrefix() string {
	prefix := os.Getenv("FILE_BASE_URL")
	if strings.TrimSpace(prefix) == "" {
		prefix = "/file"
	}
	if !strings.HasPrefix(prefix, "/") {
		prefix = "/" + prefix
	}
	return strings.TrimRight(prefix, "/")
}

// buildLocalFileURL 构建本地存储的访问 URL。
func buildLocalFileURL(path string) string {
	if path == "" {
		return ""
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return fileBaseURLPrefix() + path
}

// buildStorageFileURL 根据存储配置构建文件访问 URL。
// - 对象存储：使用 storage.Domain 作为前缀（需配置为 http(s) 开头）。
// - 本地存储或未配置域名：退回到本地静态路径 /file。
func buildStorageFileURL(storage *domainstorage.StorageDetail, fullPath string) string {
	if storage == nil {
		return buildLocalFileURL(fullPath)
	}
	switch storage.Type {
	case storageTypeOSS:
		// 对象存储必须配置 Domain，形如 http://minio:9000/bucket/
		domain := strings.TrimSpace(storage.Domain)
		if domain == "" {
			return buildLocalFileURL(fullPath)
		}
		// 规范化 Domain，保证无多余斜杠
		domain = strings.TrimRight(domain, "/")
		key := strings.TrimPrefix(fullPath, "/")
		return domain + "/" + key
	default:
		return buildLocalFileURL(fullPath)
	}
}

// normalizeParentPath ensures parent path is in the form "/xxx/yyy" (no trailing slash).
func normalizeParentPath(p string) string {
	p = strings.TrimSpace(p)
	if p == "" {
		return "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	// Drop trailing slash except for root.
	if len(p) > 1 {
		p = strings.TrimRight(p, "/")
	}
	return p
}

// UploadFile handles POST /system/file/upload and POST /common/file.
func (h *FileHandler) UploadFile(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	header, err := c.FormFile("file")
	if err != nil {
		Fail(c, "400", "文件不能为空")
		return
	}
	parentPath := c.PostForm("parentPath")
	if parentPath == "" {
		parentPath = "/"
	}

	result, derr := h.svc.Upload(c.Request.Context(), userID, header, parentPath)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	url := buildStorageFileURL(result.Storage, result.FullPath)
	resp := FileUploadResp{
		ID:       strconv.FormatInt(result.ID, 10),
		URL:      url,
		ThumbURL: url,
		Metadata: map[string]string{},
	}
	OK(c, resp)
}

// ListFile handles GET /system/file (paged).
func (h *FileHandler) ListFile(c *gin.Context) {
	originalName := strings.TrimSpace(c.Query("originalName"))
	typeStr := strings.TrimSpace(c.Query("type"))
	parentPath := strings.TrimSpace(c.Query("parentPath"))

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "30"))
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 30
	}
	var fileType int16
	if typeStr != "" && typeStr != "0" {
		if t, err := strconv.Atoi(typeStr); err == nil && t > 0 {
			fileType = int16(t)
		}
	}
	pp := strings.TrimSpace(parentPath)
	if pp != "" {
		pp = normalizeParentPath(pp)
	}

	list, total, derr := h.svc.Page(c.Request.Context(), domainstorage.FilePageQuery{
		Page:         page,
		Size:         size,
		OriginalName: originalName,
		Type:         fileType,
		ParentPath:   pp,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	if total == 0 || len(list) == 0 {
		OK(c, PageResult[FileItem]{List: []FileItem{}, Total: 0})
		return
	}

	uniqueStorageIDs := make(map[int64]struct{}, len(list))
	for _, it := range list {
		if it.StorageID > 0 {
			uniqueStorageIDs[it.StorageID] = struct{}{}
		}
	}
	storageIDs := make([]int64, 0, len(uniqueStorageIDs))
	for idVal := range uniqueStorageIDs {
		storageIDs = append(storageIDs, idVal)
	}
	storages, derr := h.svc.GetStoragesByIDs(c.Request.Context(), storageIDs)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	out := make([]FileItem, 0, len(list))
	for _, row := range list {
		var storageCfg *domainstorage.StorageDetail
		if row.StorageID > 0 {
			if cfg, ok := storages[row.StorageID]; ok {
				cpy := cfg
				storageCfg = &cpy
			}
		}
		item := FileItem{
			ID:               row.ID,
			Name:             row.Name,
			OriginalName:     row.OriginalName,
			Size:             row.Size,
			URL:              "",
			ParentPath:       row.ParentPath,
			Path:             row.Path,
			Sha256:           row.Sha256,
			ContentType:      row.ContentType,
			Metadata:         row.Metadata,
			ThumbnailSize:    row.ThumbnailSize,
			ThumbnailName:    row.ThumbnailName,
			ThumbnailMeta:    row.ThumbnailMeta,
			ThumbnailURL:     "",
			Extension:        row.Extension,
			Type:             row.Type,
			StorageID:        row.StorageID,
			StorageName:      row.StorageName,
			CreateUserString: row.CreateUserString,
			CreateTime:       formatTime(row.CreateTime),
			UpdateUserString: row.UpdateUserString,
		}
		if row.UpdateTime != nil && !row.UpdateTime.IsZero() {
			item.UpdateTime = formatTime(*row.UpdateTime)
		}
		if strings.TrimSpace(item.StorageName) == "" {
			item.StorageName = "本地存储"
		}
		item.URL = buildStorageFileURL(storageCfg, item.Path)
		if item.ThumbnailName != "" {
			parent := item.ParentPath
			if parent == "/" {
				parent = ""
			}
			thumbPath := parent + "/" + item.ThumbnailName
			item.ThumbnailURL = buildStorageFileURL(storageCfg, thumbPath)
		} else {
			item.ThumbnailURL = item.URL
		}
		out = append(out, item)
	}

	OK(c, PageResult[FileItem]{List: out, Total: total})
}

// CreateDir handles POST /system/file/dir.
func (h *FileHandler) CreateDir(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req struct {
		ParentPath   string `json:"parentPath"`
		OriginalName string `json:"originalName"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	req.OriginalName = strings.TrimSpace(req.OriginalName)
	if req.OriginalName == "" {
		Fail(c, "400", "名称不能为空")
		return
	}
	parentPath := normalizeParentPath(req.ParentPath)
	if parentPath == "" {
		parentPath = "/"
	}
	if derr := h.svc.CreateDir(c.Request.Context(), userID, parentPath, req.OriginalName); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// CalcDirSize handles GET /system/file/dir/:id/size.
func (h *FileHandler) CalcDirSize(c *gin.Context) {
	idVal, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || idVal <= 0 {
		Fail(c, "400", "ID 参数不正确")
		return
	}
	total, derr := h.svc.CalcDirSize(c.Request.Context(), idVal)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, FileDirCalcSizeResp{Size: total})
}

// Statistics handles GET /system/file/statistics.
func (h *FileHandler) Statistics(c *gin.Context) {
	stats, derr := h.svc.Statistics(c.Request.Context())
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	var list []FileStatisticsResp
	var totalSize int64
	var totalNumber int64
	for _, s := range stats {
		item := FileStatisticsResp{Type: s.Type, Number: s.Number, Size: s.Size}
		totalSize += item.Size
		totalNumber += item.Number
		list = append(list, item)
	}

	if len(list) == 0 {
		OK(c, FileStatisticsResp{})
		return
	}

	resp := FileStatisticsResp{
		Size:   totalSize,
		Number: totalNumber,
		Data:   list,
	}
	OK(c, resp)
}

// CheckFile handles GET /system/file/check?fileHash=...
func (h *FileHandler) CheckFile(c *gin.Context) {
	hash := strings.TrimSpace(c.Query("fileHash"))
	if hash == "" {
		OK[any](c, nil)
		return
	}

	row, derr := h.svc.GetByHash(c.Request.Context(), hash)
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	if row == nil {
		OK[any](c, nil)
		return
	}

	var storageCfg *domainstorage.StorageDetail
	if row.StorageID > 0 {
		storages, derr := h.svc.GetStoragesByIDs(c.Request.Context(), []int64{row.StorageID})
		if derr != nil {
			Fail(c, derr.Code, derr.Msg)
			return
		}
		if cfg, ok := storages[row.StorageID]; ok {
			cpy := cfg
			storageCfg = &cpy
		}
	}

	item := FileItem{
		ID:               row.ID,
		Name:             row.Name,
		OriginalName:     row.OriginalName,
		Size:             row.Size,
		URL:              "",
		ParentPath:       row.ParentPath,
		Path:             row.Path,
		Sha256:           row.Sha256,
		ContentType:      row.ContentType,
		Metadata:         row.Metadata,
		ThumbnailSize:    row.ThumbnailSize,
		ThumbnailName:    row.ThumbnailName,
		ThumbnailMeta:    row.ThumbnailMeta,
		ThumbnailURL:     "",
		Extension:        row.Extension,
		Type:             row.Type,
		StorageID:        row.StorageID,
		StorageName:      row.StorageName,
		CreateUserString: row.CreateUserString,
		CreateTime:       formatTime(row.CreateTime),
		UpdateUserString: row.UpdateUserString,
	}
	if row.UpdateTime != nil && !row.UpdateTime.IsZero() {
		item.UpdateTime = formatTime(*row.UpdateTime)
	}
	if strings.TrimSpace(item.StorageName) == "" {
		item.StorageName = "本地存储"
	}
	item.URL = buildStorageFileURL(storageCfg, item.Path)
	if item.ThumbnailName != "" {
		parent := item.ParentPath
		if parent == "/" {
			parent = ""
		}
		thumbPath := parent + "/" + item.ThumbnailName
		item.ThumbnailURL = buildStorageFileURL(storageCfg, thumbPath)
	} else {
		item.ThumbnailURL = item.URL
	}

	OK(c, item)
}

// UpdateFile handles PUT /system/file/:id (rename).
func (h *FileHandler) UpdateFile(c *gin.Context) {
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
		OriginalName string `json:"originalName"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, "400", "请求参数不正确")
		return
	}
	req.OriginalName = strings.TrimSpace(req.OriginalName)
	if req.OriginalName == "" {
		Fail(c, "400", "名称不能为空")
		return
	}

	if derr := h.svc.UpdateOriginalName(c.Request.Context(), userID, idVal, req.OriginalName); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}

// DeleteFile handles DELETE /system/file.
func (h *FileHandler) DeleteFile(c *gin.Context) {
	_, ok := RequireUserID(c)
	if !ok {
		return
	}

	var req idsRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		Fail(c, "400", "ID 列表不能为空")
		return
	}

	if derr := h.svc.DeleteWithPhysical(c.Request.Context(), req.IDs); derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}
	OK(c, true)
}
