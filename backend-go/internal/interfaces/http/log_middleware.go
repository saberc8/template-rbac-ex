package http

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"voc-go-backend/internal/domain/syslog"
	"voc-go-backend/internal/infrastructure/security"
)

// sysLogMiddleware 负责在 HTTP 层统一采集请求/响应信息并写入 sys_log。
// 设计目标：
//   - 尽量贴近 Java 版 LogDaoLocalImpl 的字段含义；
//   - 只记录业务接口（跳过 OPTIONS 等预检请求），减少无效数据；
//   - 出错时不影响业务请求主流程。
type sysLogMiddleware struct {
	repo     syslog.Repository
	tokenSvc *security.TokenService
	cfg      sysLogConfig
}

// NewSysLogMiddleware 创建 Gin 中间件，用于记录系统操作日志。
func NewSysLogMiddleware(repo syslog.Repository, tokenSvc *security.TokenService) gin.HandlerFunc {
	m := &sysLogMiddleware{
		repo:     repo,
		tokenSvc: tokenSvc,
		cfg:      loadSysLogConfigFromEnv(),
	}
	return m.handle
}

type sysLogConfig struct {
	maxBodyBytes   int
	skipBodyPrefix []string
}

func loadSysLogConfigFromEnv() sysLogConfig {
	return sysLogConfig{
		maxBodyBytes:   envInt("LOG_BODY_MAX_BYTES", 4*1024),
		skipBodyPrefix: envCSV("LOG_SKIP_BODY_PATHS", "/auth/login"),
	}
}

// bodyCaptureWriter 包装 ResponseWriter，用于捕获响应状态码和响应体。
type bodyCaptureWriter struct {
	gin.ResponseWriter
	status int
	body   bytes.Buffer
	max    int
	over   bool
}

func (w *bodyCaptureWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *bodyCaptureWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	if w.max > 0 && !w.over {
		remain := (w.max + 1) - w.body.Len()
		if remain > 0 {
			chunk := b
			if len(chunk) > remain {
				chunk = chunk[:remain]
			}
			_, _ = w.body.Write(chunk)
		}
		if w.body.Len() > w.max {
			w.over = true
		}
	}
	return w.ResponseWriter.Write(b)
}

// handle 是实际的中间件逻辑。
func (m *sysLogMiddleware) handle(c *gin.Context) {
	// 仅记录业务请求，跳过浏览器预检。
	if c.Request.Method == http.MethodOptions {
		c.Next()
		return
	}

	start := time.Now()

	// 读取并保留请求体，避免影响后续 handler。
	path := c.FullPath()
	if path == "" {
		path = c.Request.URL.Path
	}
	reqBody, reqBodyTruncated := m.captureRequestBody(c, path)

	// 包装响应 writer，捕获状态码与响应内容。
	origWriter := c.Writer
	cw := &bodyCaptureWriter{
		ResponseWriter: origWriter,
		max:            m.responseBodyMax(path),
	}
	c.Writer = cw

	// 执行后续处理。
	c.Next()

	duration := time.Since(start)

	// 如果没有仓储实现，直接返回，不影响主流程。
	if m.repo == nil {
		return
	}

	// 组装日志记录。

	rec := &syslog.Record{
		RequestURL:     c.Request.URL.String(),
		RequestMethod:  c.Request.Method,
		RequestHeaders: marshalHeadersRedacted(c.Request.Header),
		RequestBody:    formatBodySample(reqBody, reqBodyTruncated),
		StatusCode:     statusFromWriter(cw),
		ResponseHeaders: marshalHeadersRedacted(
			http.Header(cw.Header()),
		),
		ResponseBody: formatBodySample(cw.body.Bytes(), cw.over),
		TimeTaken:    duration.Milliseconds(),
		IP:           truncateString(c.ClientIP(), 100),
		Address:      "",
		Browser:      truncateString(c.Request.UserAgent(), 100),
		OS:           "",
		CreateTime:   start,
	}

	// 根据响应状态设置业务状态，后续如需更复杂逻辑可扩展（例如解析 APIResponse）。
	if rec.StatusCode >= http.StatusBadRequest {
		rec.Status = syslog.StatusFailure
	} else {
		rec.Status = syslog.StatusSuccess
	}

	// 从 Authorization 头解析登录用户 ID。
	if uid, ok := GetUserID(c); ok {
		rec.CreateUser = &uid
	} else if m.tokenSvc != nil {
		if authz := c.GetHeader("Authorization"); authz != "" {
			if claims, err := m.tokenSvc.Parse(authz); err == nil && claims.UserID != 0 {
				uid := claims.UserID
				rec.CreateUser = &uid
			}
		}
	}

	// 按 URL 粗略推断模块与描述，先提供基础能力，后续可按需细化。
	rec.Module, rec.Description = inferModuleAndDescription(path, c.Request.Method)

	// 最终落库，错误不影响业务，但打印错误便于排查。
	if err := m.repo.Save(c.Request.Context(), rec); err != nil {
		// 仅打印日志，不向前端暴露内部错误。
		log.Printf("[syslog] save failed: method=%s path=%s status=%d err=%v",
			c.Request.Method, path, rec.StatusCode, err)
	}
}

// marshalHeaders 将 HTTP Header 转为 JSON 字符串，便于前端调试查看。
func marshalHeaders(h http.Header) string {
	if len(h) == 0 {
		return ""
	}
	m := make(map[string]string, len(h))
	for k, v := range h {
		m[k] = strings.Join(v, ",")
	}
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	}
	return string(b)
}

func marshalHeadersRedacted(h http.Header) string {
	if len(h) == 0 {
		return ""
	}
	m := make(map[string]string, len(h))
	for k, v := range h {
		if isSensitiveHeaderKey(k) {
			m[k] = "[REDACTED]"
			continue
		}
		m[k] = strings.Join(v, ",")
	}
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	}
	return string(b)
}

func isSensitiveHeaderKey(k string) bool {
	switch strings.ToLower(strings.TrimSpace(k)) {
	case "authorization", "cookie", "set-cookie", "x-token", "x-auth-token":
		return true
	default:
		return false
	}
}

// statusFromWriter 获取最终 HTTP 状态码，未显式设置时默认为 200。
func statusFromWriter(w *bodyCaptureWriter) int {
	if w == nil || w.status == 0 {
		return http.StatusOK
	}
	return w.status
}

func (m *sysLogMiddleware) shouldSkipBody(path string) bool {
	for _, p := range m.cfg.skipBodyPrefix {
		if p == "" {
			continue
		}
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

func (m *sysLogMiddleware) requestBodyMax(c *gin.Context, path string) int {
	if m.shouldSkipBody(path) {
		return 0
	}
	ct := strings.ToLower(strings.TrimSpace(canonicalContentType(c.Request.Header.Get("Content-Type"))))
	if strings.HasPrefix(ct, "multipart/form-data") {
		return 0
	}
	return m.cfg.maxBodyBytes
}

func (m *sysLogMiddleware) responseBodyMax(path string) int {
	if m.shouldSkipBody(path) {
		return 0
	}
	return m.cfg.maxBodyBytes
}

func canonicalContentType(v string) string {
	if v == "" {
		return ""
	}
	if i := strings.IndexByte(v, ';'); i >= 0 {
		return strings.TrimSpace(v[:i])
	}
	return strings.TrimSpace(v)
}

func (m *sysLogMiddleware) captureRequestBody(c *gin.Context, path string) ([]byte, bool) {
	max := m.requestBodyMax(c, path)
	if max <= 0 || c.Request.Body == nil {
		return nil, false
	}

	full, err := io.ReadAll(io.LimitReader(c.Request.Body, int64(max+1)))
	if err != nil {
		return nil, false
	}
	// Restore request body for downstream handlers without reading the entire payload.
	c.Request.Body = io.NopCloser(io.MultiReader(bytes.NewReader(full), c.Request.Body))

	truncated := len(full) > max
	if truncated {
		return full[:max], true
	}
	return full, false
}

func formatBodySample(b []byte, truncated bool) string {
	if len(b) == 0 {
		return ""
	}
	if truncated {
		return string(b) + "\n...[TRUNCATED]"
	}
	return string(b)
}

// inferModuleAndDescription 根据路由前缀推断所属模块和简单描述。
// 这里仅做基础映射，用于满足前端系统日志展示需求。
func inferModuleAndDescription(path, method string) (module string, desc string) {
	switch {
	case strings.HasPrefix(path, "/auth/login"):
		return "登录", "用户登录"
	case strings.HasPrefix(path, "/auth/logout"):
		return "登录", "用户退出登录"
	case strings.HasPrefix(path, "/system/user"):
		return "用户管理", method + " /system/user"
	case strings.HasPrefix(path, "/system/role"):
		return "角色管理", method + " /system/role"
	case strings.HasPrefix(path, "/system/dept"):
		return "部门管理", method + " /system/dept"
	case strings.HasPrefix(path, "/system/menu"):
		return "菜单管理", method + " /system/menu"
	case strings.HasPrefix(path, "/system/dict"):
		return "字典管理", method + " /system/dict"
	case strings.HasPrefix(path, "/system/config"):
		return "系统配置", method + " /system/config"
	case strings.HasPrefix(path, "/system/storage"):
		return "存储配置", method + " /system/storage"
	case strings.HasPrefix(path, "/system/client"):
		return "客户端配置", method + " /system/client"
	case strings.HasPrefix(path, "/monitor/online"):
		return "在线用户", method + " /monitor/online"
	case strings.HasPrefix(path, "/monitor/log"):
		return "系统日志", method + " /monitor/log"
	default:
		return "其它", method + " " + path
	}
}

// truncateString 用于避免写入超过数据库字段长度的字符串。
func truncateString(s string, max int) string {
	if max <= 0 {
		return ""
	}
	if len(s) <= max {
		return s
	}
	return s[:max]
}

func envInt(key string, def int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	if n < 0 {
		return 0
	}
	return n
}

func envCSV(key string, def string) []string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		v = def
	}
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
