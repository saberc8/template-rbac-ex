package http

// 本文件提供 request-id 中间件，用于在日志与调用链路中做请求级追踪。

import (
	"crypto/rand"
	"encoding/hex"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	ctxRequestIDKey     = "requestID"
	headerRequestIDName = "X-Request-Id"
)

// RequestID 确保每个请求都有 request-id：
// - 优先复用上游传入的 X-Request-Id / X-Request-ID；
// - 若不存在则生成一个随机 ID；
// - 写入响应头并存入 Gin Context。
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		reqID := strings.TrimSpace(c.GetHeader(headerRequestIDName))
		if reqID == "" {
			reqID = strings.TrimSpace(c.GetHeader("X-Request-ID"))
		}
		if reqID == "" {
			reqID = newRequestID()
		}
		c.Set(ctxRequestIDKey, reqID)
		c.Writer.Header().Set(headerRequestIDName, reqID)
		c.Next()
	}
}

func GetRequestID(c *gin.Context) (string, bool) {
	if c == nil {
		return "", false
	}
	v, ok := c.Get(ctxRequestIDKey)
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	if !ok {
		return "", false
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return "", false
	}
	return s, true
}

func newRequestID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "rid"
	}
	return hex.EncodeToString(b[:])
}
