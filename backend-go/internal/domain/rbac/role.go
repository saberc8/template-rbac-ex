package rbac

import "time"

// Role represents a system role (sys_role).
type Role struct {
	ID                int64
	Name              string
	Code              string
	Sort              int32
	Description       string
	DataScope         int32
	IsSystem          bool
	MenuCheckStrictly bool
	DeptCheckStrictly bool

	CreateUser *int64
	CreateTime time.Time
	UpdateUser *int64
	UpdateTime *time.Time
}
