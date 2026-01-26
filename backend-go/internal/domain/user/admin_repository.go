package user

import (
	"context"
	"time"
)

// AdminUserDetail 是用户管理查询读模型（包含部门名称与创建/修改人昵称）。
type AdminUserDetail struct {
	User
	DeptName         string
	CreateUserString string
	UpdateUserString string
}

// AdminUserDetailWithPwdReset 扩展用户详情读模型（包含 pwd_reset_time）。
type AdminUserDetailWithPwdReset struct {
	AdminUserDetail
	PwdResetTime *time.Time
}

type AdminUserPageQuery struct {
	Page        int
	Size        int
	Description string
	Status      *int64
	DeptID      *int64
}

type AdminUserExportRow struct {
	Username string
	Nickname string
	Gender   int16
	Email    string
	Phone    string
}

// AdminRepository 定义用户管理（sys_user + sys_user_role）的持久化接口。
type AdminRepository interface {
	Page(ctx context.Context, q AdminUserPageQuery) ([]AdminUserDetail, int64, error)
	List(ctx context.Context, ids []int64) ([]AdminUserDetail, error)
	GetDetail(ctx context.Context, id int64) (*AdminUserDetailWithPwdReset, error)

	Create(ctx context.Context, u *User, roleIDs []int64, userRoleIDs []int64) error
	Update(ctx context.Context, u *User, roleIDs []int64, userRoleIDs []int64) error
	Delete(ctx context.Context, ids []int64) error

	UpdatePassword(ctx context.Context, id int64, password string, pwdResetTime time.Time, userID int64, now time.Time) error
	UpdateAvatar(ctx context.Context, id int64, avatar string, userID int64, now time.Time) error
	ReplaceRoles(ctx context.Context, userID int64, roleIDs []int64, userRoleIDs []int64) error

	ExportRows(ctx context.Context) ([]AdminUserExportRow, error)
}
