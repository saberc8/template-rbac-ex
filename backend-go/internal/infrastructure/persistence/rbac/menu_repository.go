package rbac

import (
	"context"
	"database/sql"
	"strings"
	"time"

	domain "voc-go-backend/internal/domain/rbac"

	"github.com/lib/pq"
)

// PgMenuRepository implements MenuRepository using PostgreSQL tables
// sys_menu, sys_role_menu, sys_user_role, sys_role and sys_user.
type PgMenuRepository struct {
	db *sql.DB
}

func NewPgMenuRepository(db *sql.DB) *PgMenuRepository {
	return &PgMenuRepository{db: db}
}

var _ domain.MenuRepository = (*PgMenuRepository)(nil)
var _ domain.MenuAdminRepository = (*PgMenuRepository)(nil)

// ListByRoleID returns menus for a given role id.
func (r *PgMenuRepository) ListByRoleID(ctx context.Context, roleID int64) ([]domain.Menu, error) {
	const query = `
SELECT
  m.id,
  m.parent_id,
  m.title,
  m.type,
  m.path,
  m.name,
  m.component,
  m.redirect,
  m.icon,
  COALESCE(m.is_external, false),
  COALESCE(m.is_cache, false),
  COALESCE(m.is_hidden, false),
  m.permission,
  COALESCE(m.sort, 0),
  m.status
FROM sys_menu AS m
JOIN sys_role_menu AS rm ON rm.menu_id = m.id
WHERE rm.role_id = $1;
`
	rows, err := r.db.QueryContext(ctx, query, roleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var menus []domain.Menu
	for rows.Next() {
		var (
			m          domain.Menu
			path, name sql.NullString
			component  sql.NullString
			redirect   sql.NullString
			icon       sql.NullString
			permission sql.NullString
		)
		if err := rows.Scan(
			&m.ID,
			&m.ParentID,
			&m.Title,
			&m.Type,
			&path,
			&name,
			&component,
			&redirect,
			&icon,
			&m.IsExternal,
			&m.IsCache,
			&m.IsHidden,
			&permission,
			&m.Sort,
			&m.Status,
		); err != nil {
			return nil, err
		}
		if path.Valid {
			m.Path = path.String
		}
		if name.Valid {
			m.Name = name.String
		}
		if component.Valid {
			m.Component = component.String
		}
		if redirect.Valid {
			m.Redirect = redirect.String
		}
		if icon.Valid {
			m.Icon = icon.String
		}
		if permission.Valid {
			m.Permission = permission.String
		}
		menus = append(menus, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return menus, nil
}

// ListPermissionsByUserID returns distinct permission strings for a user.
func (r *PgMenuRepository) ListPermissionsByUserID(ctx context.Context, userID int64) ([]string, error) {
	const query = `
SELECT DISTINCT m.permission
FROM sys_menu AS m
LEFT JOIN sys_role_menu AS rm ON rm.menu_id = m.id
LEFT JOIN sys_role AS r ON r.id = rm.role_id
LEFT JOIN sys_user_role AS ur ON ur.role_id = r.id
LEFT JOIN sys_user AS u ON u.id = ur.user_id
WHERE u.id = $1
  AND m.status = 1
  AND m.permission IS NOT NULL;
`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var perms []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return perms, nil
}

func (r *PgMenuRepository) ListAll(ctx context.Context) ([]domain.MenuDetail, error) {
	const query = `
SELECT m.id,
       m.title,
       m.parent_id,
       m.type,
       COALESCE(m.path, ''),
       COALESCE(m.name, ''),
       COALESCE(m.component, ''),
       COALESCE(m.redirect, ''),
       COALESCE(m.icon, ''),
       COALESCE(m.is_external, FALSE),
       COALESCE(m.is_cache, FALSE),
       COALESCE(m.is_hidden, FALSE),
       COALESCE(m.permission, ''),
       COALESCE(m.sort, 0),
       COALESCE(m.status, 1),
       m.create_user,
       m.create_time,
       COALESCE(cu.nickname, ''),
       m.update_user,
       m.update_time,
       COALESCE(uu.nickname, '')
FROM sys_menu AS m
LEFT JOIN sys_user AS cu ON cu.id = m.create_user
LEFT JOIN sys_user AS uu ON uu.id = m.update_user
ORDER BY m.sort ASC, m.id ASC;
`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.MenuDetail, 0, 64)
	for rows.Next() {
		var (
			item            domain.MenuDetail
			createUser      sql.NullInt64
			updateUser      sql.NullInt64
			updateTime      sql.NullTime
			parentID        sql.NullInt64
			path            sql.NullString
			name            sql.NullString
			component       sql.NullString
			redirect        sql.NullString
			icon            sql.NullString
			permission      sql.NullString
			isExternal      sql.NullBool
			isCache         sql.NullBool
			isHidden        sql.NullBool
			sortVal         sql.NullInt64
			statusVal       sql.NullInt64
			createUserStr   sql.NullString
			updateUserStr   sql.NullString
			typeVal         int16
			createTime      time.Time
		)
		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&parentID,
			&typeVal,
			&path,
			&name,
			&component,
			&redirect,
			&icon,
			&isExternal,
			&isCache,
			&isHidden,
			&permission,
			&sortVal,
			&statusVal,
			&createUser,
			&createTime,
			&createUserStr,
			&updateUser,
			&updateTime,
			&updateUserStr,
		); err != nil {
			return nil, err
		}

		if parentID.Valid {
			item.ParentID = parentID.Int64
		}
		item.Type = domain.MenuType(typeVal)
		if path.Valid {
			item.Path = path.String
		}
		if name.Valid {
			item.Name = name.String
		}
		if component.Valid {
			item.Component = component.String
		}
		if redirect.Valid {
			item.Redirect = redirect.String
		}
		if icon.Valid {
			item.Icon = icon.String
		}
		if permission.Valid {
			item.Permission = permission.String
		}
		if isExternal.Valid {
			item.IsExternal = isExternal.Bool
		}
		if isCache.Valid {
			item.IsCache = isCache.Bool
		}
		if isHidden.Valid {
			item.IsHidden = isHidden.Bool
		}
		if sortVal.Valid {
			item.Sort = int32(sortVal.Int64)
		}
		if statusVal.Valid {
			item.Status = int16(statusVal.Int64)
		}
		if createUser.Valid {
			v := createUser.Int64
			item.CreateUser = &v
		}
		item.CreateTime = createTime
		if createUserStr.Valid {
			item.CreateUserString = createUserStr.String
		}
		if updateUser.Valid {
			v := updateUser.Int64
			item.UpdateUser = &v
		}
		if updateTime.Valid {
			t := updateTime.Time
			item.UpdateTime = &t
		}
		if updateUserStr.Valid {
			item.UpdateUserString = updateUserStr.String
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *PgMenuRepository) Get(ctx context.Context, id int64) (*domain.MenuDetail, error) {
	const query = `
SELECT m.id,
       m.title,
       m.parent_id,
       m.type,
       COALESCE(m.path, ''),
       COALESCE(m.name, ''),
       COALESCE(m.component, ''),
       COALESCE(m.redirect, ''),
       COALESCE(m.icon, ''),
       COALESCE(m.is_external, FALSE),
       COALESCE(m.is_cache, FALSE),
       COALESCE(m.is_hidden, FALSE),
       COALESCE(m.permission, ''),
       COALESCE(m.sort, 0),
       COALESCE(m.status, 1),
       m.create_user,
       m.create_time,
       COALESCE(cu.nickname, ''),
       m.update_user,
       m.update_time,
       COALESCE(uu.nickname, '')
FROM sys_menu AS m
LEFT JOIN sys_user AS cu ON cu.id = m.create_user
LEFT JOIN sys_user AS uu ON uu.id = m.update_user
WHERE m.id = $1;
`
	var (
		item            domain.MenuDetail
		createUser      sql.NullInt64
		updateUser      sql.NullInt64
		updateTime      sql.NullTime
		parentID        sql.NullInt64
		path            sql.NullString
		name            sql.NullString
		component       sql.NullString
		redirect        sql.NullString
		icon            sql.NullString
		permission      sql.NullString
		isExternal      sql.NullBool
		isCache         sql.NullBool
		isHidden        sql.NullBool
		sortVal         sql.NullInt64
		statusVal       sql.NullInt64
		createUserStr   sql.NullString
		updateUserStr   sql.NullString
		typeVal         int16
		createTime      time.Time
	)
	if err := r.db.QueryRowContext(ctx, query, id).Scan(
		&item.ID,
		&item.Title,
		&parentID,
		&typeVal,
		&path,
		&name,
		&component,
		&redirect,
		&icon,
		&isExternal,
		&isCache,
		&isHidden,
		&permission,
		&sortVal,
		&statusVal,
		&createUser,
		&createTime,
		&createUserStr,
		&updateUser,
		&updateTime,
		&updateUserStr,
	); err != nil {
		return nil, err
	}

	if parentID.Valid {
		item.ParentID = parentID.Int64
	}
	item.Type = domain.MenuType(typeVal)
	if path.Valid {
		item.Path = path.String
	}
	if name.Valid {
		item.Name = name.String
	}
	if component.Valid {
		item.Component = component.String
	}
	if redirect.Valid {
		item.Redirect = redirect.String
	}
	if icon.Valid {
		item.Icon = icon.String
	}
	if permission.Valid {
		item.Permission = permission.String
	}
	if isExternal.Valid {
		item.IsExternal = isExternal.Bool
	}
	if isCache.Valid {
		item.IsCache = isCache.Bool
	}
	if isHidden.Valid {
		item.IsHidden = isHidden.Bool
	}
	if sortVal.Valid {
		item.Sort = int32(sortVal.Int64)
	}
	if statusVal.Valid {
		item.Status = int16(statusVal.Int64)
	}
	if createUser.Valid {
		v := createUser.Int64
		item.CreateUser = &v
	}
	item.CreateTime = createTime
	if createUserStr.Valid {
		item.CreateUserString = createUserStr.String
	}
	if updateUser.Valid {
		v := updateUser.Int64
		item.UpdateUser = &v
	}
	if updateTime.Valid {
		t := updateTime.Time
		item.UpdateTime = &t
	}
	if updateUserStr.Valid {
		item.UpdateUserString = updateUserStr.String
	}
	return &item, nil
}

func (r *PgMenuRepository) Create(ctx context.Context, m *domain.Menu) error {
	const stmt = `
INSERT INTO sys_menu (
    id, title, parent_id, type, path, name, component, redirect,
    icon, is_external, is_cache, is_hidden, permission, sort, status,
    create_user, create_time
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15,
    $16, $17
);
`

	var parentID any
	if m.ParentID > 0 {
		parentID = m.ParentID
	} else {
		parentID = 0
	}
	createUser := any(nil)
	if m.CreateUser != nil {
		createUser = *m.CreateUser
	}
	_, err := r.db.ExecContext(
		ctx,
		stmt,
		m.ID,
		strings.TrimSpace(m.Title),
		parentID,
		int16(m.Type),
		strings.TrimSpace(m.Path),
		strings.TrimSpace(m.Name),
		strings.TrimSpace(m.Component),
		strings.TrimSpace(m.Redirect),
		strings.TrimSpace(m.Icon),
		m.IsExternal,
		m.IsCache,
		m.IsHidden,
		strings.TrimSpace(m.Permission),
		m.Sort,
		m.Status,
		createUser,
		m.CreateTime,
	)
	return err
}

func (r *PgMenuRepository) Update(ctx context.Context, m *domain.Menu) error {
	const stmt = `
UPDATE sys_menu
   SET title       = $1,
       parent_id   = $2,
       type        = $3,
       path        = $4,
       name        = $5,
       component   = $6,
       redirect    = $7,
       icon        = $8,
       is_external = $9,
       is_cache    = $10,
       is_hidden   = $11,
       permission  = $12,
       sort        = $13,
       status      = $14,
       update_user = $15,
       update_time = $16
 WHERE id          = $17;
`
	updateUser := any(nil)
	if m.UpdateUser != nil {
		updateUser = *m.UpdateUser
	}
	updateTime := any(nil)
	if m.UpdateTime != nil {
		updateTime = *m.UpdateTime
	}
	_, err := r.db.ExecContext(
		ctx,
		stmt,
		strings.TrimSpace(m.Title),
		m.ParentID,
		int16(m.Type),
		strings.TrimSpace(m.Path),
		strings.TrimSpace(m.Name),
		strings.TrimSpace(m.Component),
		strings.TrimSpace(m.Redirect),
		strings.TrimSpace(m.Icon),
		m.IsExternal,
		m.IsCache,
		m.IsHidden,
		strings.TrimSpace(m.Permission),
		m.Sort,
		m.Status,
		updateUser,
		updateTime,
		m.ID,
	)
	return err
}

func (r *PgMenuRepository) DeleteCascade(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	rows, err := r.db.QueryContext(ctx, `SELECT id, parent_id FROM sys_menu;`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type node struct {
		id       int64
		parentID int64
	}
	var all []node
	for rows.Next() {
		var n node
		if err := rows.Scan(&n.id, &n.parentID); err != nil {
			return err
		}
		all = append(all, n)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	childrenOf := make(map[int64][]int64)
	for _, n := range all {
		childrenOf[n.parentID] = append(childrenOf[n.parentID], n.id)
	}

	seen := make(map[int64]struct{})
	var collect func(id int64)
	collect = func(id int64) {
		if _, ok := seen[id]; ok {
			return
		}
		seen[id] = struct{}{}
		for _, ch := range childrenOf[id] {
			collect(ch)
		}
	}
	for _, idVal := range ids {
		if idVal <= 0 {
			continue
		}
		collect(idVal)
	}
	if len(seen) == 0 {
		return nil
	}
	allIDs := make([]int64, 0, len(seen))
	for idVal := range seen {
		allIDs = append(allIDs, idVal)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_role_menu WHERE menu_id = ANY($1::bigint[])`, pq.Int64Array(allIDs)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_menu WHERE id = ANY($1::bigint[])`, pq.Int64Array(allIDs)); err != nil {
		return err
	}
	return tx.Commit()
}
