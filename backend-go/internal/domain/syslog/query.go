package syslog

import "time"

// QueryFilter 表示系统日志查询条件。
type QueryFilter struct {
	Page int
	Size int

	Description string
	Module      string
	IP          string
	CreateUser  string
	Status      int64

	StartTime *time.Time
	EndTime   *time.Time
}

// ListItem 表示日志列表行（用于分页列表）。
type ListItem struct {
	ID               int64
	Description      string
	Module           string
	TimeTaken        int64
	IP               string
	Address          string
	Browser          string
	OS               string
	Status           int16
	ErrorMsg         string
	CreateUserString string
	CreateTime       time.Time
}

// Detail 表示日志详情（用于详情页）。
type Detail struct {
	ID               int64
	TraceID          string
	Description      string
	Module           string
	RequestURL       string
	RequestMethod    string
	RequestHeaders   string
	RequestBody      string
	StatusCode       int32
	ResponseHeaders  string
	ResponseBody     string
	TimeTaken        int64
	IP               string
	Address          string
	Browser          string
	OS               string
	Status           int16
	ErrorMsg         string
	CreateUserString string
	CreateTime       time.Time
}

