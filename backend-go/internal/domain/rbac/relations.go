package rbac

// RoleMenu 表示角色与菜单的关联，对应 sys_role_menu 表。
type RoleMenu struct {
	RoleID int64
	MenuID int64
}

// RoleDept 表示角色与部门的关联，对应 sys_role_dept 表。
type RoleDept struct {
	RoleID int64
	DeptID int64
}

// UserRole 表示用户与角色的关联，对应 sys_user_role 表。
type UserRole struct {
	ID     int64
	UserID int64
	RoleID int64
}

