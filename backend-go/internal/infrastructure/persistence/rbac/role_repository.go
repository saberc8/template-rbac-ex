package rbac

import (
	"context"
	"database/sql"
	"strings"
	"time"

	domain "voc-go-backend/internal/domain/rbac"

	"github.com/lib/pq"
)

// PgRoleRepository implements RoleRepository using PostgreSQL tables
// sys_role and sys_user_role.
type PgRoleRepository struct {
	db *sql.DB
}

func NewPgRoleRepository(db *sql.DB) *PgRoleRepository {
	return &PgRoleRepository{db: db}
}

var _ domain.RoleRepository = (*PgRoleRepository)(nil)
var _ domain.RoleAdminRepository = (*PgRoleRepository)(nil)

// ListByUserID returns roles for a given user id.
func (r *PgRoleRepository) ListByUserID(ctx context.Context, userID int64) ([]domain.Role, error) {
	const query = `
SELECT r.id, r.name, r.code, r.data_scope
FROM sys_role AS r
JOIN sys_user_role AS ur ON ur.role_id = r.id
WHERE ur.user_id = $1;
`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []domain.Role
	for rows.Next() {
		var rl domain.Role
		if err := rows.Scan(&rl.ID, &rl.Name, &rl.Code, &rl.DataScope); err != nil {
			return nil, err
		}
		roles = append(roles, rl)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return roles, nil
}

// ListCodesByUserID returns role codes for a given user.
func (r *PgRoleRepository) ListCodesByUserID(ctx context.Context, userID int64) ([]string, error) {
	const query = `
SELECT r.code
FROM sys_role AS r
JOIN sys_user_role AS ur ON ur.role_id = r.id
WHERE ur.user_id = $1;
`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var codes []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return codes, nil
}

func (r *PgRoleRepository) ListAll(ctx context.Context) ([]domain.RoleDetail, error) {
	const query = `
SELECT r.id,
       r.name,
       r.code,
       COALESCE(r.sort, 999),
       COALESCE(r.description, ''),
       COALESCE(r.data_scope, 4),
       COALESCE(r.is_system, FALSE),
       r.create_user,
       r.create_time,
       COALESCE(cu.nickname, ''),
       r.update_user,
       r.update_time,
       COALESCE(uu.nickname, '')
FROM sys_role AS r
LEFT JOIN sys_user AS cu ON cu.id = r.create_user
LEFT JOIN sys_user AS uu ON uu.id = r.update_user
ORDER BY r.sort ASC, r.id ASC;
`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.RoleDetail, 0, 32)
	for rows.Next() {
		var (
			item        domain.RoleDetail
			isSystem    sql.NullBool
			sortVal     sql.NullInt64
			dataScope   sql.NullInt64
			createUser  sql.NullInt64
			updateUser  sql.NullInt64
			updateTime  sql.NullTime
			createBy    sql.NullString
			updateBy    sql.NullString
			createTime  time.Time
		)
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Code,
			&sortVal,
			&item.Description,
			&dataScope,
			&isSystem,
			&createUser,
			&createTime,
			&createBy,
			&updateUser,
			&updateTime,
			&updateBy,
		); err != nil {
			return nil, err
		}
		if sortVal.Valid {
			item.Sort = int32(sortVal.Int64)
		}
		if dataScope.Valid {
			item.DataScope = int32(dataScope.Int64)
		}
		if isSystem.Valid {
			item.IsSystem = isSystem.Bool
		}
		if createUser.Valid {
			v := createUser.Int64
			item.CreateUser = &v
		}
		item.CreateTime = createTime
		if createBy.Valid {
			item.CreateUserString = createBy.String
		}
		if updateUser.Valid {
			v := updateUser.Int64
			item.UpdateUser = &v
		}
		if updateTime.Valid {
			t := updateTime.Time
			item.UpdateTime = &t
		}
		if updateBy.Valid {
			item.UpdateUserString = updateBy.String
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *PgRoleRepository) GetDetail(ctx context.Context, id int64) (*domain.RoleDetailWithRelations, error) {
	const query = `
SELECT r.id,
       r.name,
       r.code,
       COALESCE(r.sort, 999),
       COALESCE(r.description, ''),
       COALESCE(r.data_scope, 4),
       COALESCE(r.is_system, FALSE),
       COALESCE(r.menu_check_strictly, TRUE),
       COALESCE(r.dept_check_strictly, TRUE),
       r.create_user,
       r.create_time,
       COALESCE(cu.nickname, ''),
       r.update_user,
       r.update_time,
       COALESCE(uu.nickname, '')
FROM sys_role AS r
LEFT JOIN sys_user AS cu ON cu.id = r.create_user
LEFT JOIN sys_user AS uu ON uu.id = r.update_user
WHERE r.id = $1;
`
	var (
		item        domain.RoleDetailWithRelations
		isSystem    sql.NullBool
		sortVal     sql.NullInt64
		dataScope   sql.NullInt64
		menuStrict  sql.NullBool
		deptStrict  sql.NullBool
		createUser  sql.NullInt64
		updateUser  sql.NullInt64
		updateTime  sql.NullTime
		createBy    sql.NullString
		updateBy    sql.NullString
		createTime  time.Time
	)
	if err := r.db.QueryRowContext(ctx, query, id).Scan(
		&item.ID,
		&item.Name,
		&item.Code,
		&sortVal,
		&item.Description,
		&dataScope,
		&isSystem,
		&menuStrict,
		&deptStrict,
		&createUser,
		&createTime,
		&createBy,
		&updateUser,
		&updateTime,
		&updateBy,
	); err != nil {
		return nil, err
	}
	if sortVal.Valid {
		item.Sort = int32(sortVal.Int64)
	}
	if dataScope.Valid {
		item.DataScope = int32(dataScope.Int64)
	}
	if isSystem.Valid {
		item.IsSystem = isSystem.Bool
	}
	if menuStrict.Valid {
		item.MenuCheckStrictly = menuStrict.Bool
	}
	if deptStrict.Valid {
		item.DeptCheckStrictly = deptStrict.Bool
	}
	if createUser.Valid {
		v := createUser.Int64
		item.CreateUser = &v
	}
	item.CreateTime = createTime
	if createBy.Valid {
		item.CreateUserString = createBy.String
	}
	if updateUser.Valid {
		v := updateUser.Int64
		item.UpdateUser = &v
	}
	if updateTime.Valid {
		t := updateTime.Time
		item.UpdateTime = &t
	}
	if updateBy.Valid {
		item.UpdateUserString = updateBy.String
	}

	menuRows, err := r.db.QueryContext(ctx, `SELECT menu_id FROM sys_role_menu WHERE role_id = $1`, id)
	if err != nil {
		return nil, err
	}
	defer menuRows.Close()
	for menuRows.Next() {
		var mid int64
		if err := menuRows.Scan(&mid); err != nil {
			return nil, err
		}
		item.MenuIDs = append(item.MenuIDs, mid)
	}
	if err := menuRows.Err(); err != nil {
		return nil, err
	}

	deptRows, err := r.db.QueryContext(ctx, `SELECT dept_id FROM sys_role_dept WHERE role_id = $1`, id)
	if err != nil {
		return nil, err
	}
	defer deptRows.Close()
	for deptRows.Next() {
		var did int64
		if err := deptRows.Scan(&did); err != nil {
			return nil, err
		}
		item.DeptIDs = append(item.DeptIDs, did)
	}
	if err := deptRows.Err(); err != nil {
		return nil, err
	}

	return &item, nil
}

func (r *PgRoleRepository) Create(ctx context.Context, role *domain.Role, deptIDs []int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	const insertRole = `
INSERT INTO sys_role (
    id, name, code, data_scope, description, sort,
    is_system, menu_check_strictly, dept_check_strictly,
    create_user, create_time
)
VALUES ($1, $2, $3, $4, $5, $6,
        FALSE, TRUE, $7,
        $8, $9);
`
	createUser := any(nil)
	if role.CreateUser != nil {
		createUser = *role.CreateUser
	}
	if _, err := tx.ExecContext(
		ctx,
		insertRole,
		role.ID,
		strings.TrimSpace(role.Name),
		strings.TrimSpace(role.Code),
		role.DataScope,
		strings.TrimSpace(role.Description),
		role.Sort,
		role.DeptCheckStrictly,
		createUser,
		role.CreateTime,
	); err != nil {
		return err
	}

	if len(deptIDs) > 0 {
		const insertDept = `INSERT INTO sys_role_dept (role_id, dept_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`
		for _, did := range deptIDs {
			if did <= 0 {
				continue
			}
			if _, err := tx.ExecContext(ctx, insertDept, role.ID, did); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func (r *PgRoleRepository) Update(ctx context.Context, role *domain.Role, deptIDs []int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	const updateRole = `
UPDATE sys_role
   SET name               = $1,
       description        = $2,
       sort               = $3,
       data_scope         = $4,
       dept_check_strictly= $5,
       update_user        = $6,
       update_time        = $7
 WHERE id                 = $8;
`
	updateUser := any(nil)
	if role.UpdateUser != nil {
		updateUser = *role.UpdateUser
	}
	updateTime := any(nil)
	if role.UpdateTime != nil {
		updateTime = *role.UpdateTime
	}
	if _, err := tx.ExecContext(
		ctx,
		updateRole,
		strings.TrimSpace(role.Name),
		strings.TrimSpace(role.Description),
		role.Sort,
		role.DataScope,
		role.DeptCheckStrictly,
		updateUser,
		updateTime,
		role.ID,
	); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_role_dept WHERE role_id = $1`, role.ID); err != nil {
		return err
	}
	if len(deptIDs) > 0 {
		const insertDept = `INSERT INTO sys_role_dept (role_id, dept_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`
		for _, did := range deptIDs {
			if did <= 0 {
				continue
			}
			if _, err := tx.ExecContext(ctx, insertDept, role.ID, did); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func (r *PgRoleRepository) Delete(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	arr := pq.Int64Array(ids)
	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_user_role WHERE role_id = ANY($1::bigint[])`, arr); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_role_menu WHERE role_id = ANY($1::bigint[])`, arr); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_role_dept WHERE role_id = ANY($1::bigint[])`, arr); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_role WHERE id = ANY($1::bigint[])`, arr); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *PgRoleRepository) UpdatePermission(ctx context.Context, roleID int64, menuIDs []int64, menuStrict bool, userID int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_role_menu WHERE role_id = $1`, roleID); err != nil {
		return err
	}
	const insertMenu = `INSERT INTO sys_role_menu (role_id, menu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`
	for _, mid := range menuIDs {
		if mid <= 0 {
			continue
		}
		if _, err := tx.ExecContext(ctx, insertMenu, roleID, mid); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE sys_role SET menu_check_strictly = $1, update_user = $2, update_time = $3 WHERE id = $4`,
		menuStrict,
		userID,
		time.Now(),
		roleID,
	); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *PgRoleRepository) ListRoleUsers(ctx context.Context, roleID int64) ([]domain.RoleUserDetail, error) {
	const query = `
SELECT ur.id,
       ur.role_id,
       u.id,
       u.username,
       u.nickname,
       u.gender,
       u.status,
       u.is_system,
       COALESCE(u.description, ''),
       u.dept_id,
       COALESCE(d.name, '')
FROM sys_user_role AS ur
JOIN sys_user AS u ON u.id = ur.user_id
LEFT JOIN sys_dept AS d ON d.id = u.dept_id
WHERE ur.role_id = $1
ORDER BY ur.id DESC;
`
	rows, err := r.db.QueryContext(ctx, query, roleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.RoleUserDetail, 0, 32)
	for rows.Next() {
		var item domain.RoleUserDetail
		if err := rows.Scan(
			&item.ID,
			&item.RoleID,
			&item.UserID,
			&item.Username,
			&item.Nickname,
			&item.Gender,
			&item.Status,
			&item.IsSystem,
			&item.Description,
			&item.DeptID,
			&item.DeptName,
		); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *PgRoleRepository) ListUserRoles(ctx context.Context, userIDs []int64) (map[int64][]domain.RoleBrief, error) {
	if len(userIDs) == 0 {
		return map[int64][]domain.RoleBrief{}, nil
	}
	const roleQuery = `
SELECT ur.user_id, ur.role_id, r.name
FROM sys_user_role AS ur
JOIN sys_role AS r ON r.id = ur.role_id
WHERE ur.user_id = ANY($1::bigint[]);
`
	rows, err := r.db.QueryContext(ctx, roleQuery, pq.Int64Array(userIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[int64][]domain.RoleBrief)
	for rows.Next() {
		var uid, rid int64
		var name string
		if err := rows.Scan(&uid, &rid, &name); err != nil {
			return nil, err
		}
		out[uid] = append(out[uid], domain.RoleBrief{RoleID: rid, RoleName: name})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *PgRoleRepository) AssignUsers(ctx context.Context, roleID int64, userRoleIDs []int64, userIDs []int64) error {
	if len(userRoleIDs) == 0 || len(userIDs) == 0 {
		return nil
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	const insertUserRole = `
INSERT INTO sys_user_role (id, user_id, role_id)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, role_id) DO NOTHING;
`
	n := len(userIDs)
	if len(userRoleIDs) < n {
		n = len(userRoleIDs)
	}
	for i := 0; i < n; i++ {
		if userIDs[i] <= 0 {
			continue
		}
		if _, err := tx.ExecContext(ctx, insertUserRole, userRoleIDs[i], userIDs[i], roleID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *PgRoleRepository) UnassignUserRoles(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.db.ExecContext(ctx, `DELETE FROM sys_user_role WHERE id = ANY($1::bigint[])`, pq.Int64Array(ids))
	return err
}

func (r *PgRoleRepository) ListRoleUserIDs(ctx context.Context, roleID int64) ([]int64, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT user_id FROM sys_user_role WHERE role_id = $1`, roleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var uid int64
		if err := rows.Scan(&uid); err != nil {
			return nil, err
		}
		ids = append(ids, uid)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}
