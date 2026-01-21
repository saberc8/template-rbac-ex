package http

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	appsyslog "voc-go-backend/internal/application/syslog"
	domainsyslog "voc-go-backend/internal/domain/syslog"
)

// LogResp 与前端 LogResp 类型对齐。
type LogResp struct {
	ID               int64  `json:"id"`
	Description      string `json:"description"`
	Module           string `json:"module"`
	TimeTaken        int64  `json:"timeTaken"`
	IP               string `json:"ip"`
	Address          string `json:"address"`
	Browser          string `json:"browser"`
	OS               string `json:"os"`
	Status           int16  `json:"status"`
	ErrorMsg         string `json:"errorMsg"`
	CreateUserString string `json:"createUserString"`
	CreateTime       string `json:"createTime"`
}

// LogDetailResp 与前端 LogDetailResp 类型对齐。
type LogDetailResp struct {
	ID               int64  `json:"id"`
	TraceID          string `json:"traceId"`
	Description      string `json:"description"`
	Module           string `json:"module"`
	RequestURL       string `json:"requestUrl"`
	RequestMethod    string `json:"requestMethod"`
	RequestHeaders   string `json:"requestHeaders"`
	RequestBody      string `json:"requestBody"`
	StatusCode       int32  `json:"statusCode"`
	ResponseHeaders  string `json:"responseHeaders"`
	ResponseBody     string `json:"responseBody"`
	TimeTaken        int64  `json:"timeTaken"`
	IP               string `json:"ip"`
	Address          string `json:"address"`
	Browser          string `json:"browser"`
	OS               string `json:"os"`
	Status           int16  `json:"status"`
	ErrorMsg         string `json:"errorMsg"`
	CreateUserString string `json:"createUserString"`
	CreateTime       string `json:"createTime"`
}

// LogHandler 提供 /system/log 相关接口。
type LogHandler struct {
	svc *appsyslog.Service
}

// NewLogHandler 创建日志 handler。
func NewLogHandler(svc *appsyslog.Service) *LogHandler {
	return &LogHandler{svc: svc}
}

// RegisterLogRoutes 注册系统日志路由。
func (h *LogHandler) RegisterLogRoutes(r *gin.Engine) {
	r.GET("/system/log", h.PageLog)
	r.GET("/system/log/:id", h.GetLog)
	r.GET("/system/log/export/login", h.ExportLoginLog)
	r.GET("/system/log/export/operation", h.ExportOperationLog)
}

// PageLog 处理 GET /system/log，返回分页日志列表。
func (h *LogHandler) PageLog(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	size, _ := strconv.Atoi(c.Query("size"))
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 10
	}

	description := strings.TrimSpace(c.Query("description"))
	module := strings.TrimSpace(c.Query("module"))
	ip := strings.TrimSpace(c.Query("ip"))
	createUser := strings.TrimSpace(c.Query("createUserString"))
	statusStr := strings.TrimSpace(c.Query("status"))

	var statusFilter int64
	if statusStr != "" {
		statusFilter, _ = strconv.ParseInt(statusStr, 10, 64)
	}

	var (
		startTime *time.Time
		endTime   *time.Time
	)
	timeRange := c.QueryArray("createTime")
	if len(timeRange) == 2 {
		if t, err := time.ParseInLocation("2006-01-02 15:04:05", timeRange[0], time.Local); err == nil {
			startTime = &t
		}
		if t, err := time.ParseInLocation("2006-01-02 15:04:05", timeRange[1], time.Local); err == nil {
			endTime = &t
		}
	}

	list, total, derr := h.svc.Page(c.Request.Context(), domainsyslog.QueryFilter{
		Page:        page,
		Size:        size,
		Description: description,
		Module:      module,
		IP:          ip,
		CreateUser:  createUser,
		Status:      statusFilter,
		StartTime:   startTime,
		EndTime:     endTime,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	out := make([]LogResp, 0, len(list))
	for _, item := range list {
		out = append(out, LogResp{
			ID:               item.ID,
			Description:      item.Description,
			Module:           item.Module,
			TimeTaken:        item.TimeTaken,
			IP:               item.IP,
			Address:          item.Address,
			Browser:          item.Browser,
			OS:               item.OS,
			Status:           item.Status,
			ErrorMsg:         item.ErrorMsg,
			CreateUserString: item.CreateUserString,
			CreateTime:       formatTime(item.CreateTime),
		})
	}
	OK(c, PageResult[LogResp]{List: out, Total: total})
}

// GetLog 处理 GET /system/log/:id，返回日志详情。
func (h *LogHandler) GetLog(c *gin.Context) {
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
	resp := LogDetailResp{
		ID:               item.ID,
		TraceID:          item.TraceID,
		Description:      item.Description,
		Module:           item.Module,
		RequestURL:       item.RequestURL,
		RequestMethod:    item.RequestMethod,
		RequestHeaders:   item.RequestHeaders,
		RequestBody:      item.RequestBody,
		StatusCode:       item.StatusCode,
		ResponseHeaders:  item.ResponseHeaders,
		ResponseBody:     item.ResponseBody,
		TimeTaken:        item.TimeTaken,
		IP:               item.IP,
		Address:          item.Address,
		Browser:          item.Browser,
		OS:               item.OS,
		Status:           item.Status,
		ErrorMsg:         item.ErrorMsg,
		CreateUserString: item.CreateUserString,
		CreateTime:       formatTime(item.CreateTime),
	}
	OK(c, resp)
}

// ExportLoginLog 处理 GET /system/log/export/login，导出登录日志 CSV。
func (h *LogHandler) ExportLoginLog(c *gin.Context) {
	h.exportLogCSV(c, true)
}

// ExportOperationLog 处理 GET /system/log/export/operation，导出操作日志 CSV。
func (h *LogHandler) ExportOperationLog(c *gin.Context) {
	h.exportLogCSV(c, false)
}

// exportLogCSV 按条件导出登录/操作日志为 CSV。
func (h *LogHandler) exportLogCSV(c *gin.Context, isLogin bool) {
	description := strings.TrimSpace(c.Query("description"))
	module := strings.TrimSpace(c.Query("module"))
	ip := strings.TrimSpace(c.Query("ip"))
	createUser := strings.TrimSpace(c.Query("createUserString"))
	statusStr := strings.TrimSpace(c.Query("status"))

	var statusFilter int64
	if statusStr != "" {
		statusFilter, _ = strconv.ParseInt(statusStr, 10, 64)
	}

	var (
		startTime *time.Time
		endTime   *time.Time
	)
	timeRange := c.QueryArray("createTime")
	if len(timeRange) == 2 {
		if t, err := time.ParseInLocation("2006-01-02 15:04:05", timeRange[0], time.Local); err == nil {
			startTime = &t
		}
		if t, err := time.ParseInLocation("2006-01-02 15:04:05", timeRange[1], time.Local); err == nil {
			endTime = &t
		}
	}

	items, derr := h.svc.ListForExport(c.Request.Context(), domainsyslog.QueryFilter{
		Description: description,
		Module:      module,
		IP:          ip,
		CreateUser:  createUser,
		Status:      statusFilter,
		StartTime:   startTime,
		EndTime:     endTime,
	})
	if derr != nil {
		Fail(c, derr.Code, derr.Msg)
		return
	}

	if len(items) == 0 {
		// 无数据时返回一个空文件，避免前端认为是错误响应。
		c.Header("Content-Type", "text/csv; charset=utf-8")
		if isLogin {
			c.Header("Content-Disposition", "attachment; filename=\"login-log.csv\"")
		} else {
			c.Header("Content-Disposition", "attachment; filename=\"operation-log.csv\"")
		}
		c.String(http.StatusOK, "")
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	if isLogin {
		c.Header("Content-Disposition", "attachment; filename=\"login-log.csv\"")
	} else {
		c.Header("Content-Disposition", "attachment; filename=\"operation-log.csv\"")
	}

	// 简单按逗号分隔输出 CSV，字段中若包含逗号/换行可以按需增强转义，这里先满足基础导出需求。
	w := c.Writer

	if isLogin {
		// 登录日志导出列
		fmt.Fprintln(w, "ID,登录时间,用户昵称,登录行为,状态,登录 IP,登录地点,浏览器,终端系统")
		for _, r := range items {
			statusText := "成功"
			if r.Status != 1 {
				statusText = "失败"
			}
			line := fmt.Sprintf("%d,%s,%s,%s,%s,%s,%s,%s,%s",
				r.ID,
				formatTime(r.CreateTime),
				escapeCSV(r.CreateUserString),
				escapeCSV(r.Description),
				statusText,
				escapeCSV(r.IP),
				escapeCSV(r.Address),
				escapeCSV(r.Browser),
				escapeCSV(r.OS),
			)
			fmt.Fprintln(w, line)
		}
	} else {
		// 操作日志导出列
		fmt.Fprintln(w, "ID,操作时间,操作人,操作内容,所属模块,状态,操作 IP,操作地点,耗时（ms）,浏览器,终端系统")
		for _, r := range items {
			statusText := "成功"
			if r.Status != 1 {
				statusText = "失败"
			}
			line := fmt.Sprintf("%d,%s,%s,%s,%s,%s,%s,%s,%d,%s,%s",
				r.ID,
				formatTime(r.CreateTime),
				escapeCSV(r.CreateUserString),
				escapeCSV(r.Description),
				escapeCSV(r.Module),
				statusText,
				escapeCSV(r.IP),
				escapeCSV(r.Address),
				r.TimeTaken,
				escapeCSV(r.Browser),
				escapeCSV(r.OS),
			)
			fmt.Fprintln(w, line)
		}
	}
}

// escapeCSV 对包含逗号或引号的字段进行简单转义。
func escapeCSV(val string) string {
	if val == "" {
		return ""
	}
	if !strings.ContainsAny(val, ",\"\n\r") {
		return val
	}
	escaped := strings.ReplaceAll(val, `"`, `""`)
	return `"` + escaped + `"`
}
