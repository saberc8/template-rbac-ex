package system

import "time"

// Dept 表示一个部门实体，对应 sys_dept 表。
type Dept struct {
	ID          int64
	Name        string
	ParentID    int64
	Sort        int32
	Status      int16
	IsSystem    bool
	Description string

	CreateUser *int64
	CreateTime time.Time
	UpdateUser *int64
	UpdateTime *time.Time
}

// DeptDetail 是部门查询用的读模型（包含创建/修改人昵称）。
type DeptDetail struct {
	Dept
	CreateUserString string
	UpdateUserString string
}

