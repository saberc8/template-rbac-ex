package rbac

import "context"

// MenuDetail 是菜单查询读模型（包含创建/修改人昵称）。
type MenuDetail struct {
	Menu
	CreateUserString string
	UpdateUserString string
}

// MenuAdminRepository 定义菜单管理（sys_menu）的持久化接口。
// 注意：权限/鉴权侧可继续使用 MenuRepository（更窄的读接口）。
type MenuAdminRepository interface {
	ListAll(ctx context.Context) ([]MenuDetail, error)
	Get(ctx context.Context, id int64) (*MenuDetail, error)
	Create(ctx context.Context, m *Menu) error
	Update(ctx context.Context, m *Menu) error
	DeleteCascade(ctx context.Context, ids []int64) error
}
