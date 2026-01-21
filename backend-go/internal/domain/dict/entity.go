package dict

import "time"

// Dict 表示字典实体，对应 sys_dict 表。
type Dict struct {
	ID               int64
	Name             string
	Code             string
	IsSystem         bool
	Description      string
	CreateUserString string
	CreateTime       time.Time
	UpdateUserString string
	UpdateTime       *time.Time
}

// DictItem 表示字典项实体，对应 sys_dict_item 表。
type DictItem struct {
	ID               int64
	Label            string
	Value            string
	Color            string
	Sort             int32
	Description      string
	Status           int16
	DictID           int64
	CreateUserString string
	CreateTime       time.Time
	UpdateUserString string
	UpdateTime       *time.Time
}

