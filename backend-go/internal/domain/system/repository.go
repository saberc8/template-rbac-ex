package system

import "context"

type DeptListFilter struct {
	Description string
	Status      int64
}

// DeptRepository 定义部门聚合的持久化接口。
type DeptRepository interface {
	List(ctx context.Context, f DeptListFilter) ([]DeptDetail, error)
	Get(ctx context.Context, id int64) (*DeptDetail, error)
	NameExistsUnderParent(ctx context.Context, parentID int64, name string, excludeID *int64) (bool, error)
	Exists(ctx context.Context, id int64) (bool, error)
	GetMeta(ctx context.Context, id int64) (name string, parentID int64, isSystem bool, err error)

	HasChildren(ctx context.Context, ids []int64) (bool, error)
	HasUsers(ctx context.Context, ids []int64) (bool, error)
	FindSystemDeptName(ctx context.Context, ids []int64) (string, bool, error)

	Create(ctx context.Context, d *Dept) error
	Update(ctx context.Context, d *Dept) error
	Delete(ctx context.Context, ids []int64) error
}

type OptionListFilter struct {
	Codes    []string
	Category string
}

type OptionUpdate struct {
	ID    int64
	Code  string
	Value string
}

type OptionResetFilter struct {
	Codes    []string
	Category string
}

// OptionRepository 定义系统配置项的持久化接口。
type OptionRepository interface {
	List(ctx context.Context, f OptionListFilter) ([]OptionView, error)
	// GetMergedValue 返回 COALESCE(value, default_value, '')，并标记是否存在该配置项。
	GetMergedValue(ctx context.Context, code string) (string, bool, error)
	UpdateValues(ctx context.Context, userID int64, updates []OptionUpdate) error
	ResetValues(ctx context.Context, f OptionResetFilter) error
}
