package dict

import "time"

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

type DictCreateRequest struct {
	Name        string
	Code        string
	Description string
}

type DictUpdateRequest struct {
	Name        string
	Description string
}

type DictItemCreateRequest struct {
	Label       string
	Value       string
	Color       string
	Sort        int32
	Description string
	Status      int16
	DictID      int64
}

type DictItemUpdateRequest struct {
	Label       string
	Value       string
	Color       string
	Sort        int32
	Description string
	Status      int16
}

type DictItemPageQuery struct {
	DictID      *int64
	Page        int
	Size        int
	Description string
	Status      *int64
}
