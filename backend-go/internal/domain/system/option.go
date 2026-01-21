package system

import "time"

// Option 表示系统配置项，对应 sys_option 表。
type Option struct {
	ID          int64
	Name        string
	Code        string
	Value       *string
	DefaultVal  *string
	Category    *string
	Description string
	Sort        int32
	Status      int16
	IsSystem    bool

	CreateUser *int64
	CreateTime time.Time
	UpdateUser *int64
	UpdateTime *time.Time
}

// OptionView 是接口展示用的读模型（包含合并后的 value）。
type OptionView struct {
	ID          int64
	Name        string
	Code        string
	Value       string
	Description string
}

