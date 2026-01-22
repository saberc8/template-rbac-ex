package user

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	domain "go-backend/internal/domain/user"
	"go-backend/internal/infrastructure/persistence/sqlutil"
)

var _ domain.AdminRepository = (*PgRepository)(nil)

func (r *PgRepository) Page(ctx context.Context, q domain.AdminUserPageQuery) ([]domain.AdminUserDetail, int64, error) {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Size <= 0 {
		q.Size = 10
	}

	where := "WHERE 1=1"
	args := []any{}

	if strings.TrimSpace(q.Description) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(q.Description)) + "%"
		where += " AND (LOWER(u.username) LIKE ? OR LOWER(u.nickname) LIKE ? OR LOWER(COALESCE(u.description,'')) LIKE ?)"
		args = append(args, like, like, like)
	}
	if q.Status != nil && *q.Status != 0 {
		where += " AND u.status = ?"
		args = append(args, *q.Status)
	}
	if q.DeptID != nil && *q.DeptID != 0 {
		where += " AND u.dept_id = ?"
		args = append(args, *q.DeptID)
	}

	countSQL := "SELECT COUNT(*) FROM sys_user AS u " + where
	var total int64
	qr := sqlutil.QuerierFromContext(ctx, r.db)
	if err := qr.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, countSQL), args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domain.AdminUserDetail{}, 0, nil
	}

	offset := int64((q.Page - 1) * q.Size)
	argsWithPage := append(args, int64(q.Size), offset)

	query := `
SELECT u.id,
       u.username,
       u.nickname,
       u.password,
       u.gender,
       u.email,
       u.phone,
       u.avatar,
       u.description,
       u.status,
       u.is_system,
       u.dept_id,
       COALESCE(d.name, ''),
       u.create_user,
       u.create_time,
       COALESCE(cu.nickname, ''),
       u.update_user,
       u.update_time,
       COALESCE(uu.nickname, '')
FROM sys_user AS u
LEFT JOIN sys_dept AS d ON d.id = u.dept_id
LEFT JOIN sys_user AS cu ON cu.id = u.create_user
LEFT JOIN sys_user AS uu ON uu.id = u.update_user
` + where + `
ORDER BY u.id DESC
LIMIT ? OFFSET ?;
`

	rows, err := qr.QueryContext(ctx, sqlutil.Rebind(r.dialect, query), argsWithPage...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	list := make([]domain.AdminUserDetail, 0, q.Size)
	for rows.Next() {
		var (
			item             domain.AdminUserDetail
			email, phone     sql.NullString
			avatar, desc     sql.NullString
			deptName         sql.NullString
			createUser       sql.NullInt64
			updateUser       sql.NullInt64
			updateTime       sql.NullTime
			createUserString sql.NullString
			updateUserString sql.NullString
			password         sql.NullString
		)
		if err := rows.Scan(
			&item.ID,
			&item.Username,
			&item.Nickname,
			&password,
			&item.Gender,
			&email,
			&phone,
			&avatar,
			&desc,
			&item.Status,
			&item.IsSystem,
			&item.DeptID,
			&deptName,
			&createUser,
			&item.CreateTime,
			&createUserString,
			&updateUser,
			&updateTime,
			&updateUserString,
		); err != nil {
			return nil, 0, err
		}
		if password.Valid {
			item.Password = password.String
		}
		if email.Valid {
			v := email.String
			item.Email = &v
		}
		if phone.Valid {
			v := phone.String
			item.Phone = &v
		}
		if avatar.Valid {
			v := avatar.String
			item.Avatar = &v
		}
		if desc.Valid {
			v := desc.String
			item.Description = &v
		}
		if deptName.Valid {
			item.DeptName = deptName.String
		}
		if createUser.Valid {
			v := createUser.Int64
			item.CreateUser = &v
		}
		if createUserString.Valid {
			item.CreateUserString = createUserString.String
		}
		if updateUser.Valid {
			v := updateUser.Int64
			item.UpdateUser = &v
		}
		if updateTime.Valid {
			t := updateTime.Time
			item.UpdateTime = &t
		}
		if updateUserString.Valid {
			item.UpdateUserString = updateUserString.String
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

func (r *PgRepository) List(ctx context.Context, ids []int64) ([]domain.AdminUserDetail, error) {
	baseQuery := `
SELECT u.id,
       u.username,
       u.nickname,
       u.password,
       u.gender,
       u.email,
       u.phone,
       u.avatar,
       u.description,
       u.status,
       u.is_system,
       u.dept_id,
       COALESCE(d.name, ''),
       u.create_user,
       u.create_time,
       COALESCE(cu.nickname, ''),
       u.update_user,
       u.update_time,
       COALESCE(uu.nickname, '')
FROM sys_user AS u
LEFT JOIN sys_dept AS d ON d.id = u.dept_id
LEFT JOIN sys_user AS cu ON cu.id = u.create_user
LEFT JOIN sys_user AS uu ON uu.id = u.update_user
`

	qr := sqlutil.QuerierFromContext(ctx, r.db)
	var (
		query string
		args  []any
		err   error
	)
	if len(ids) > 0 {
		query, args, err = sqlutil.In(r.dialect, baseQuery+"WHERE u.id IN (?)", ids)
	} else {
		query = sqlutil.Rebind(r.dialect, baseQuery+"ORDER BY u.id DESC")
		args = []any{}
	}
	if err != nil {
		return nil, err
	}
	rows, err := qr.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.AdminUserDetail, 0, 64)
	for rows.Next() {
		var (
			item             domain.AdminUserDetail
			email, phone     sql.NullString
			avatar, desc     sql.NullString
			deptName         sql.NullString
			createUser       sql.NullInt64
			updateUser       sql.NullInt64
			updateTime       sql.NullTime
			createUserString sql.NullString
			updateUserString sql.NullString
			password         sql.NullString
		)
		if err := rows.Scan(
			&item.ID,
			&item.Username,
			&item.Nickname,
			&password,
			&item.Gender,
			&email,
			&phone,
			&avatar,
			&desc,
			&item.Status,
			&item.IsSystem,
			&item.DeptID,
			&deptName,
			&createUser,
			&item.CreateTime,
			&createUserString,
			&updateUser,
			&updateTime,
			&updateUserString,
		); err != nil {
			return nil, err
		}
		if password.Valid {
			item.Password = password.String
		}
		if email.Valid {
			v := email.String
			item.Email = &v
		}
		if phone.Valid {
			v := phone.String
			item.Phone = &v
		}
		if avatar.Valid {
			v := avatar.String
			item.Avatar = &v
		}
		if desc.Valid {
			v := desc.String
			item.Description = &v
		}
		if deptName.Valid {
			item.DeptName = deptName.String
		}
		if createUser.Valid {
			v := createUser.Int64
			item.CreateUser = &v
		}
		if createUserString.Valid {
			item.CreateUserString = createUserString.String
		}
		if updateUser.Valid {
			v := updateUser.Int64
			item.UpdateUser = &v
		}
		if updateTime.Valid {
			t := updateTime.Time
			item.UpdateTime = &t
		}
		if updateUserString.Valid {
			item.UpdateUserString = updateUserString.String
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *PgRepository) GetDetail(ctx context.Context, id int64) (*domain.AdminUserDetailWithPwdReset, error) {
	const query = `
SELECT u.id,
       u.username,
       u.nickname,
       u.password,
       u.gender,
       u.email,
       u.phone,
       u.avatar,
       u.description,
       u.status,
       u.is_system,
       u.dept_id,
       COALESCE(d.name, ''),
       u.pwd_reset_time,
       u.create_user,
       u.create_time,
       COALESCE(cu.nickname, ''),
       u.update_user,
       u.update_time,
       COALESCE(uu.nickname, '')
FROM sys_user AS u
LEFT JOIN sys_dept AS d ON d.id = u.dept_id
LEFT JOIN sys_user AS cu ON cu.id = u.create_user
LEFT JOIN sys_user AS uu ON uu.id = u.update_user
WHERE u.id = ?;
`
	var (
		item             domain.AdminUserDetailWithPwdReset
		email, phone     sql.NullString
		avatar, desc     sql.NullString
		deptName         sql.NullString
		createUser       sql.NullInt64
		updateUser       sql.NullInt64
		updateTime       sql.NullTime
		createUserString sql.NullString
		updateUserString sql.NullString
		password         sql.NullString
		pwdResetTime     sql.NullTime
	)
	qr := sqlutil.QuerierFromContext(ctx, r.db)
	err := qr.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, query), id).Scan(
		&item.ID,
		&item.Username,
		&item.Nickname,
		&password,
		&item.Gender,
		&email,
		&phone,
		&avatar,
		&desc,
		&item.Status,
		&item.IsSystem,
		&item.DeptID,
		&deptName,
		&pwdResetTime,
		&createUser,
		&item.CreateTime,
		&createUserString,
		&updateUser,
		&updateTime,
		&updateUserString,
	)
	if err != nil {
		return nil, err
	}
	if password.Valid {
		item.Password = password.String
	}
	if email.Valid {
		v := email.String
		item.Email = &v
	}
	if phone.Valid {
		v := phone.String
		item.Phone = &v
	}
	if avatar.Valid {
		v := avatar.String
		item.Avatar = &v
	}
	if desc.Valid {
		v := desc.String
		item.Description = &v
	}
	if deptName.Valid {
		item.DeptName = deptName.String
	}
	if pwdResetTime.Valid {
		t := pwdResetTime.Time
		item.PwdResetTime = &t
	}
	if createUser.Valid {
		v := createUser.Int64
		item.CreateUser = &v
	}
	if createUserString.Valid {
		item.CreateUserString = createUserString.String
	}
	if updateUser.Valid {
		v := updateUser.Int64
		item.UpdateUser = &v
	}
	if updateTime.Valid {
		t := updateTime.Time
		item.UpdateTime = &t
	}
	if updateUserString.Valid {
		item.UpdateUserString = updateUserString.String
	}
	return &item, nil
}

func (r *PgRepository) Create(ctx context.Context, u *domain.User, roleIDs []int64, userRoleIDs []int64) error {
	if u == nil {
		return errors.New("nil user")
	}
	tx, owned, err := beginTx(ctx, r.db)
	if err != nil {
		return err
	}
	if owned {
		defer tx.Rollback()
	}

	const insertUser = `
INSERT INTO sys_user (
    id, username, nickname, password, gender, email, phone, avatar,
    description, status, is_system, pwd_reset_time, dept_id,
    create_user, create_time
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, FALSE, ?, ?,
        ?, ?);
`
	if _, err := tx.ExecContext(
		ctx,
		sqlutil.Rebind(r.dialect, insertUser),
		u.ID,
		u.Username,
		u.Nickname,
		u.Password,
		u.Gender,
		nilIfBlankPtr(u.Email),
		nilIfBlankPtr(u.Phone),
		nilIfBlankPtr(u.Avatar),
		nilIfBlankPtr(u.Description),
		u.Status,
		timeOrNow(u.PwdResetTime, u.CreateTime),
		u.DeptID,
		derefInt64Ptr(u.CreateUser),
		u.CreateTime,
	); err != nil {
		return err
	}

	if len(roleIDs) > 0 {
		insertUserRole := `
INSERT INTO sys_user_role (id, user_id, role_id)
VALUES (?, ?, ?)
`
		if r.dialect == "mysql" {
			insertUserRole += "ON DUPLICATE KEY UPDATE id = id"
		} else {
			insertUserRole += "ON CONFLICT (user_id, role_id) DO NOTHING"
		}
		n := len(roleIDs)
		if len(userRoleIDs) < n {
			n = len(userRoleIDs)
		}
		for i := 0; i < n; i++ {
			if roleIDs[i] <= 0 {
				continue
			}
			if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, insertUserRole), userRoleIDs[i], u.ID, roleIDs[i]); err != nil {
				return err
			}
		}
	}

	if owned {
		return tx.Commit()
	}
	return nil
}

func (r *PgRepository) Update(ctx context.Context, u *domain.User, roleIDs []int64, userRoleIDs []int64) error {
	if u == nil {
		return errors.New("nil user")
	}
	tx, owned, err := beginTx(ctx, r.db)
	if err != nil {
		return err
	}
	if owned {
		defer tx.Rollback()
	}

	const updateUser = `
UPDATE sys_user
   SET username    = ?,
       nickname    = ?,
       gender      = ?,
       email       = ?,
       phone       = ?,
       avatar      = ?,
       description = ?,
       status      = ?,
       dept_id     = ?,
       update_user = ?,
       update_time = ?
 WHERE id          = ?;
`
	var updateTime any
	if u.UpdateTime != nil {
		updateTime = *u.UpdateTime
	}
	if _, err := tx.ExecContext(
		ctx,
		sqlutil.Rebind(r.dialect, updateUser),
		u.Username,
		u.Nickname,
		u.Gender,
		nilIfBlankPtr(u.Email),
		nilIfBlankPtr(u.Phone),
		nilIfBlankPtr(u.Avatar),
		nilIfBlankPtr(u.Description),
		u.Status,
		u.DeptID,
		derefInt64Ptr(u.UpdateUser),
		updateTime,
		u.ID,
	); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, `DELETE FROM sys_user_role WHERE user_id = ?`), u.ID); err != nil {
		return err
	}
	if len(roleIDs) > 0 {
		insertUserRole := `
INSERT INTO sys_user_role (id, user_id, role_id)
VALUES (?, ?, ?)
`
		if r.dialect == "mysql" {
			insertUserRole += "ON DUPLICATE KEY UPDATE id = id"
		} else {
			insertUserRole += "ON CONFLICT (user_id, role_id) DO NOTHING"
		}
		n := len(roleIDs)
		if len(userRoleIDs) < n {
			n = len(userRoleIDs)
		}
		for i := 0; i < n; i++ {
			if roleIDs[i] <= 0 {
				continue
			}
			if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, insertUserRole), userRoleIDs[i], u.ID, roleIDs[i]); err != nil {
				return err
			}
		}
	}

	if owned {
		return tx.Commit()
	}
	return nil
}

func (r *PgRepository) Delete(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	tx, owned, err := beginTx(ctx, r.db)
	if err != nil {
		return err
	}
	if owned {
		defer tx.Rollback()
	}

	for _, idVal := range ids {
		var isSystem bool
		if err := tx.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, `SELECT is_system FROM sys_user WHERE id = ?`), idVal).Scan(&isSystem); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				continue
			}
			return err
		}
		if isSystem {
			continue
		}
		if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, `DELETE FROM sys_user_role WHERE user_id = ?`), idVal); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, `DELETE FROM sys_user WHERE id = ?`), idVal); err != nil {
			return err
		}
	}

	if owned {
		return tx.Commit()
	}
	return nil
}

func (r *PgRepository) UpdatePassword(ctx context.Context, id int64, password string, pwdResetTime time.Time, userID int64, now time.Time) error {
	qr := sqlutil.QuerierFromContext(ctx, r.db)
	_, err := qr.ExecContext(
		ctx,
		sqlutil.Rebind(r.dialect, `UPDATE sys_user SET password = ?, pwd_reset_time = ?, update_user = ?, update_time = ? WHERE id = ?`),
		password,
		pwdResetTime,
		userID,
		now,
		id,
	)
	return err
}

func (r *PgRepository) ReplaceRoles(ctx context.Context, userID int64, roleIDs []int64, userRoleIDs []int64) error {
	tx, owned, err := beginTx(ctx, r.db)
	if err != nil {
		return err
	}
	if owned {
		defer tx.Rollback()
	}

	if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, `DELETE FROM sys_user_role WHERE user_id = ?`), userID); err != nil {
		return err
	}
	if len(roleIDs) > 0 {
		insertUserRole := `
INSERT INTO sys_user_role (id, user_id, role_id)
VALUES (?, ?, ?)
`
		if r.dialect == "mysql" {
			insertUserRole += "ON DUPLICATE KEY UPDATE id = id"
		} else {
			insertUserRole += "ON CONFLICT (user_id, role_id) DO NOTHING"
		}
		n := len(roleIDs)
		if len(userRoleIDs) < n {
			n = len(userRoleIDs)
		}
		for i := 0; i < n; i++ {
			if roleIDs[i] <= 0 {
				continue
			}
			if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, insertUserRole), userRoleIDs[i], userID, roleIDs[i]); err != nil {
				return err
			}
		}
	}

	if owned {
		return tx.Commit()
	}
	return nil
}

func (r *PgRepository) ExportRows(ctx context.Context) ([]domain.AdminUserExportRow, error) {
	qr := sqlutil.QuerierFromContext(ctx, r.db)
	rows, err := qr.QueryContext(ctx, `SELECT username, nickname, gender, COALESCE(email,''), COALESCE(phone,'') FROM sys_user ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.AdminUserExportRow
	for rows.Next() {
		var row domain.AdminUserExportRow
		if err := rows.Scan(&row.Username, &row.Nickname, &row.Gender, &row.Email, &row.Phone); err != nil {
			return nil, err
		}
		list = append(list, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func derefInt64Ptr(v *int64) any {
	if v == nil {
		return nil
	}
	return *v
}

func nilIfBlankPtr(s *string) any {
	if s == nil {
		return nil
	}
	if strings.TrimSpace(*s) == "" {
		return nil
	}
	return *s
}

func timeOrNow(t *time.Time, now time.Time) time.Time {
	if t == nil || t.IsZero() {
		return now
	}
	return *t
}

func beginTx(ctx context.Context, db *sql.DB) (*sql.Tx, bool, error) {
	if tx := sqlutil.TxFromContext(ctx); tx != nil {
		return tx, false, nil
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, false, err
	}
	return tx, true, nil
}
