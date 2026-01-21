package rbac

import "context"

// RoleDetail 是角色查询读模型（包含创建/修改人昵称）。
type RoleDetail struct {
	Role
	CreateUserString string
	UpdateUserString string
}

// RoleDetailWithRelations 是角色详情读模型（包含菜单/部门关联）。
type RoleDetailWithRelations struct {
	RoleDetail
	MenuIDs []int64
	DeptIDs []int64
}

// RoleUserDetail 是角色-用户关联读模型（sys_user_role 列表）。
type RoleUserDetail struct {
	ID          int64 // sys_user_role.id
	RoleID      int64
	UserID      int64
	Username    string
	Nickname    string
	Gender      int16
	Status      int16
	IsSystem    bool
	Description string
	DeptID      int64
	DeptName    string
}

// RoleBrief 用于聚合用户的角色列表。
type RoleBrief struct {
	RoleID   int64
	RoleName string
}

// RoleAdminRepository 定义角色管理（sys_role + 关联表）的持久化接口。
type RoleAdminRepository interface {
	ListAll(ctx context.Context) ([]RoleDetail, error)
	GetDetail(ctx context.Context, id int64) (*RoleDetailWithRelations, error)

	Create(ctx context.Context, role *Role, deptIDs []int64) error
	Update(ctx context.Context, role *Role, deptIDs []int64) error
	Delete(ctx context.Context, ids []int64) error

	UpdatePermission(ctx context.Context, roleID int64, menuIDs []int64, menuStrict bool, userID int64) error

	ListRoleUsers(ctx context.Context, roleID int64) ([]RoleUserDetail, error)
	ListUserRoles(ctx context.Context, userIDs []int64) (map[int64][]RoleBrief, error)

	AssignUsers(ctx context.Context, roleID int64, userRoleIDs []int64, userIDs []int64) error
	UnassignUserRoles(ctx context.Context, ids []int64) error
	ListRoleUserIDs(ctx context.Context, roleID int64) ([]int64, error)
}

