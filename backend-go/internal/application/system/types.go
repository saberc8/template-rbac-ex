package system

// DeptCreateRequest 表示创建部门的请求参数。
type DeptCreateRequest struct {
	Name        string
	ParentID    int64
	Sort        int32
	Status      int16
	Description string
}

// DeptUpdateRequest 表示更新部门的请求参数。
type DeptUpdateRequest struct {
	Name        string
	ParentID    int64
	Sort        int32
	Status      int16
	Description string
}

// OptionUpdateRequest 表示批量更新配置的单项。
type OptionUpdateRequest struct {
	ID    int64
	Code  string
	Value any
}

type OptionResetRequest struct {
	Codes    []string
	Category string
}

