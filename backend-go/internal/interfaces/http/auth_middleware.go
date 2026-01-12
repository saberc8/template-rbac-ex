package http

import (
	"github.com/gin-gonic/gin"

	"voc-go-backend/internal/infrastructure/security"
)

const ctxUserIDKey = "userID"

// AuthContext parses Authorization header if present and stores userID in Gin context.
// It never aborts the request by itself; handlers that require authentication should
// call RequireUserID.
func AuthContext(tokenSvc *security.TokenService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if tokenSvc == nil {
			c.Next()
			return
		}
		authz := c.GetHeader("Authorization")
		if authz != "" {
			if claims, err := tokenSvc.Parse(authz); err == nil && claims != nil && claims.UserID != 0 {
				c.Set(ctxUserIDKey, claims.UserID)
			}
		}
		c.Next()
	}
}

func GetUserID(c *gin.Context) (int64, bool) {
	if c == nil {
		return 0, false
	}
	v, ok := c.Get(ctxUserIDKey)
	if !ok {
		return 0, false
	}
	userID, ok := v.(int64)
	if !ok || userID == 0 {
		return 0, false
	}
	return userID, true
}

// RequireUserID returns the userID from context, or writes 401 and aborts.
func RequireUserID(c *gin.Context) (int64, bool) {
	userID, ok := GetUserID(c)
	if ok {
		return userID, true
	}
	Fail(c, "401", "未授权，请重新登录")
	c.Abort()
	return 0, false
}
