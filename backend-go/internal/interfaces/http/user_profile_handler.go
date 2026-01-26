package http

import (
	"strings"

	"github.com/gin-gonic/gin"

	appstorage "go-backend/internal/application/storage"
	appuser "go-backend/internal/application/user"
)

// UserProfileHandler provides /user/profile endpoints.
type UserProfileHandler struct {
	fileSvc *appstorage.FileService
	userSvc *appuser.AdminService
}

func NewUserProfileHandler(fileSvc *appstorage.FileService, userSvc *appuser.AdminService) *UserProfileHandler {
	return &UserProfileHandler{fileSvc: fileSvc, userSvc: userSvc}
}

func (h *UserProfileHandler) RegisterUserProfileRoutes(r *gin.Engine) {
	r.PATCH("/user/profile/avatar", h.UploadAvatar)
}

// UploadAvatar handles PATCH /user/profile/avatar (multipart form field: avatarFile).
func (h *UserProfileHandler) UploadAvatar(c *gin.Context) {
	userID, ok := RequireUserID(c)
	if !ok {
		return
	}

	header, err := c.FormFile("avatarFile")
	if err != nil {
		Fail(c, "400", "文件不能为空")
		return
	}

	if h == nil || h.fileSvc == nil || h.userSvc == nil {
		Fail(c, "500", "系统异常")
		return
	}

	result, derr := h.fileSvc.Upload(c.Request.Context(), userID, header, "/avatar")
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	relURL := buildStorageFileURL(result.Storage, result.FullPath)
	avatarURL := relURL
	if strings.HasPrefix(relURL, "/") {
		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
		avatarURL = scheme + "://" + c.Request.Host + relURL
	}

	if uerr := h.userSvc.UpdateAvatar(c.Request.Context(), userID, avatarURL); uerr != nil {
		Fail(c, uerr.Code, uerr.Msg)
		return
	}

	OK(c, gin.H{"avatar": avatarURL})
}

