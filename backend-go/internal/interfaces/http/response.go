package http

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"go-backend/internal/core/apperr"
)

// APIResponse matches the front-end's ApiRes<T> definition.
type APIResponse[T any] struct {
	Code      string `json:"code"`
	Data      T      `json:"data"`
	Msg       string `json:"msg"`
	Success   bool   `json:"success"`
	Timestamp string `json:"timestamp"`
}

// PageResult represents a generic paginated result.
type PageResult[T any] struct {
	List  []T   `json:"list"`
	Total int64 `json:"total"`
}

// nowString returns current time as epoch milliseconds string,
// matching the front-end expectation (Number(res.timestamp)).
func nowString() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10)
}

// OK wraps data in a success response.
func OK[T any](c *gin.Context, data T) {
	resp := APIResponse[T]{
		Code:      "200",
		Data:      data,
		Msg:       "操作成功",
		Success:   true,
		Timestamp: nowString(),
	}
	c.JSON(http.StatusOK, resp)
}

// Fail returns a failed response with the given code and message.
func Fail(c *gin.Context, code, msg string) {
	resp := APIResponse[any]{
		Code:      code,
		Data:      nil,
		Msg:       msg,
		Success:   false,
		Timestamp: nowString(),
	}
	c.JSON(http.StatusOK, resp)
}

// FailErr 将应用错误映射为统一响应；非业务错误统一返回 500。
func FailErr(c *gin.Context, err error) {
	if err == nil {
		Fail(c, "500", "系统异常")
		return
	}
	var ae *apperr.Error
	if errors.As(err, &ae) && ae != nil && ae.Code != "" {
		Fail(c, ae.Code, ae.Msg)
		return
	}
	Fail(c, "500", "系统异常")
}
