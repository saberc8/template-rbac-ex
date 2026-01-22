package dict

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	domaindict "go-backend/internal/domain/dict"
	"go-backend/internal/infrastructure/persistence/sqlutil"
)

type PgRepository struct {
	db      *sql.DB
	dialect string
}

func NewRepository(db *sql.DB, dialect string) *PgRepository {
	return &PgRepository{db: db, dialect: dialect}
}

func NewPgRepository(db *sql.DB) *PgRepository {
	return NewRepository(db, "postgres")
}

var _ domaindict.Repository = (*PgRepository)(nil)

func (r *PgRepository) ListDict(ctx context.Context, description string) ([]domaindict.Dict, error) {
	args := []any{}
	where := ""
	if strings.TrimSpace(description) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(description)) + "%"
		where = "WHERE (LOWER(d.name) LIKE ? OR LOWER(COALESCE(d.description,'')) LIKE ?)"
		args = append(args, like, like)
	}

	query := fmt.Sprintf(`
SELECT d.id,
       d.name,
       d.code,
       COALESCE(d.description, ''),
       COALESCE(d.is_system, FALSE),
       d.create_time,
       COALESCE(cu.nickname, ''),
       d.update_time,
       COALESCE(uu.nickname, '')
FROM sys_dict AS d
LEFT JOIN sys_user AS cu ON cu.id = d.create_user
LEFT JOIN sys_user AS uu ON uu.id = d.update_user
%s
ORDER BY d.create_time DESC, d.id DESC;
`, where)

	rows, err := r.db.QueryContext(ctx, sqlutil.Rebind(r.dialect, query), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domaindict.Dict
	for rows.Next() {
		var (
			item     domaindict.Dict
			updateAt sql.NullTime
		)
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Code,
			&item.Description,
			&item.IsSystem,
			&item.CreateTime,
			&item.CreateUserString,
			&updateAt,
			&item.UpdateUserString,
		); err != nil {
			return nil, err
		}
		if updateAt.Valid {
			t := updateAt.Time
			item.UpdateTime = &t
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *PgRepository) GetDict(ctx context.Context, id int64) (*domaindict.Dict, error) {
	const query = `
SELECT d.id,
       d.name,
       d.code,
       COALESCE(d.description, ''),
       COALESCE(d.is_system, FALSE),
       d.create_time,
       COALESCE(cu.nickname, ''),
       d.update_time,
       COALESCE(uu.nickname, '')
FROM sys_dict AS d
LEFT JOIN sys_user AS cu ON cu.id = d.create_user
LEFT JOIN sys_user AS uu ON uu.id = d.update_user
WHERE d.id = ?;
`
	var (
		item     domaindict.Dict
		updateAt sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, query), id).Scan(
		&item.ID,
		&item.Name,
		&item.Code,
		&item.Description,
		&item.IsSystem,
		&item.CreateTime,
		&item.CreateUserString,
		&updateAt,
		&item.UpdateUserString,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if updateAt.Valid {
		t := updateAt.Time
		item.UpdateTime = &t
	}
	return &item, nil
}

func (r *PgRepository) DictNameExists(ctx context.Context, name string) (bool, error) {
	const q = `SELECT 1 FROM sys_dict WHERE name = ? LIMIT 1;`
	var tmp int
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, q), name).Scan(&tmp)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *PgRepository) DictCodeExists(ctx context.Context, code string) (bool, error) {
	const q = `SELECT 1 FROM sys_dict WHERE code = ? LIMIT 1;`
	var tmp int
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, q), code).Scan(&tmp)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *PgRepository) CreateDict(ctx context.Context, id int64, name, code, description string, userID int64, now time.Time) error {
	const stmt = `
INSERT INTO sys_dict (id, name, code, description, is_system, create_user, create_time)
VALUES (?, ?, ?, ?, FALSE, ?, ?);
`
	_, err := r.db.ExecContext(ctx, sqlutil.Rebind(r.dialect, stmt), id, name, code, description, userID, now)
	return err
}

func (r *PgRepository) UpdateDict(ctx context.Context, id int64, name, description string, userID int64, now time.Time) error {
	const stmt = `
UPDATE sys_dict
   SET name = ?,
       description = ?,
       update_user = ?,
       update_time = ?
 WHERE id = ?;
`
	_, err := r.db.ExecContext(ctx, sqlutil.Rebind(r.dialect, stmt), name, description, userID, now, id)
	return err
}

func (r *PgRepository) DeleteDict(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	q1, args1, err := sqlutil.In(r.dialect, `DELETE FROM sys_dict_item WHERE dict_id IN (?)`, ids)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, q1, args1...); err != nil {
		return err
	}
	q2, args2, err := sqlutil.In(r.dialect, `DELETE FROM sys_dict WHERE id IN (?)`, ids)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, q2, args2...); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *PgRepository) PageDictItem(ctx context.Context, q domaindict.DictItemPageQuery) ([]domaindict.DictItem, int64, error) {
	baseFrom := `
FROM sys_dict_item AS di
LEFT JOIN sys_user AS cu ON cu.id = di.create_user
LEFT JOIN sys_user AS uu ON uu.id = di.update_user
`
	where := "WHERE 1=1"
	args := []any{}

	if q.DictID != nil && *q.DictID != 0 {
		where += " AND di.dict_id = ?"
		args = append(args, *q.DictID)
	}
	if strings.TrimSpace(q.Description) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(q.Description)) + "%"
		where += " AND (LOWER(di.label) LIKE ? OR LOWER(COALESCE(di.description,'')) LIKE ?)"
		args = append(args, like, like)
	}
	if q.Status != nil && *q.Status != 0 {
		where += " AND di.status = ?"
		args = append(args, *q.Status)
	}

	countSQL := "SELECT COUNT(*) " + baseFrom + where
	var total int64
	if err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, countSQL), args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domaindict.DictItem{}, 0, nil
	}

	offset := int64((q.Page - 1) * q.Size)
	argsWithPage := append(args, int64(q.Size), offset)

	query := `
SELECT di.id,
       di.label,
       di.value,
       COALESCE(di.color, ''),
       COALESCE(di.sort, 999),
       COALESCE(di.description, ''),
       di.status,
       di.dict_id,
       di.create_time,
       COALESCE(cu.nickname, ''),
       di.update_time,
       COALESCE(uu.nickname, '')
` + baseFrom + where + `
ORDER BY di.sort ASC, di.id ASC
LIMIT ? OFFSET ?;
`

	rows, err := r.db.QueryContext(ctx, sqlutil.Rebind(r.dialect, query), argsWithPage...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []domaindict.DictItem
	for rows.Next() {
		var (
			item     domaindict.DictItem
			updateAt sql.NullTime
		)
		if err := rows.Scan(
			&item.ID,
			&item.Label,
			&item.Value,
			&item.Color,
			&item.Sort,
			&item.Description,
			&item.Status,
			&item.DictID,
			&item.CreateTime,
			&item.CreateUserString,
			&updateAt,
			&item.UpdateUserString,
		); err != nil {
			return nil, 0, err
		}
		if updateAt.Valid {
			t := updateAt.Time
			item.UpdateTime = &t
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *PgRepository) GetDictItem(ctx context.Context, id int64) (*domaindict.DictItem, error) {
	const query = `
SELECT di.id,
       di.label,
       di.value,
       COALESCE(di.color, ''),
       COALESCE(di.sort, 999),
       COALESCE(di.description, ''),
       di.status,
       di.dict_id,
       di.create_time,
       COALESCE(cu.nickname, ''),
       di.update_time,
       COALESCE(uu.nickname, '')
FROM sys_dict_item AS di
LEFT JOIN sys_user AS cu ON cu.id = di.create_user
LEFT JOIN sys_user AS uu ON uu.id = di.update_user
WHERE di.id = ?;
`
	var (
		item     domaindict.DictItem
		updateAt sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, query), id).Scan(
		&item.ID,
		&item.Label,
		&item.Value,
		&item.Color,
		&item.Sort,
		&item.Description,
		&item.Status,
		&item.DictID,
		&item.CreateTime,
		&item.CreateUserString,
		&updateAt,
		&item.UpdateUserString,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if updateAt.Valid {
		t := updateAt.Time
		item.UpdateTime = &t
	}
	return &item, nil
}

func (r *PgRepository) CreateDictItem(ctx context.Context, id int64, req domaindict.DictItemCreateRequest, userID int64, now time.Time) error {
	const stmt = `
INSERT INTO sys_dict_item (
    id, label, value, color, sort, description, status, dict_id,
    create_user, create_time
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`
	_, err := r.db.ExecContext(
		ctx,
		sqlutil.Rebind(r.dialect, stmt),
		id,
		req.Label,
		req.Value,
		req.Color,
		req.Sort,
		req.Description,
		req.Status,
		req.DictID,
		userID,
		now,
	)
	return err
}

func (r *PgRepository) UpdateDictItem(ctx context.Context, id int64, req domaindict.DictItemUpdateRequest, userID int64, now time.Time) error {
	const stmt = `
UPDATE sys_dict_item
   SET label       = ?,
       value       = ?,
       color       = ?,
       sort        = ?,
       description = ?,
       status      = ?,
       update_user = ?,
       update_time = ?
 WHERE id          = ?;
`
	_, err := r.db.ExecContext(
		ctx,
		sqlutil.Rebind(r.dialect, stmt),
		req.Label,
		req.Value,
		req.Color,
		req.Sort,
		req.Description,
		req.Status,
		userID,
		now,
		id,
	)
	return err
}

func (r *PgRepository) DeleteDictItem(ctx context.Context, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	q1, args1, err := sqlutil.In(r.dialect, `DELETE FROM sys_dict_item WHERE id IN (?)`, ids)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, q1, args1...); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *PgRepository) ListActiveItemsByCode(ctx context.Context, code string) ([]domaindict.DictItem, error) {
	const query = `
SELECT t1.id,
       t1.label,
       t1.value,
       COALESCE(t1.color, '') AS color,
       COALESCE(t1.sort, 999) AS sort,
       COALESCE(t1.description, '') AS description,
       COALESCE(t1.status, 1) AS status,
       t1.dict_id,
       t1.create_time,
       COALESCE(cu.nickname, ''),
       t1.update_time,
       COALESCE(uu.nickname, '')
FROM sys_dict_item AS t1
LEFT JOIN sys_dict AS t2 ON t1.dict_id = t2.id
LEFT JOIN sys_user AS cu ON cu.id = t1.create_user
LEFT JOIN sys_user AS uu ON uu.id = t1.update_user
WHERE t1.status = 1
  AND t2.code = ?
ORDER BY t1.sort ASC, t1.id ASC;
`
	rows, err := r.db.QueryContext(ctx, sqlutil.Rebind(r.dialect, query), strings.TrimSpace(code))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domaindict.DictItem, 0)
	for rows.Next() {
		var (
			item     domaindict.DictItem
			updateAt sql.NullTime
		)
		if err := rows.Scan(
			&item.ID,
			&item.Label,
			&item.Value,
			&item.Color,
			&item.Sort,
			&item.Description,
			&item.Status,
			&item.DictID,
			&item.CreateTime,
			&item.CreateUserString,
			&updateAt,
			&item.UpdateUserString,
		); err != nil {
			return nil, err
		}
		if updateAt.Valid {
			t := updateAt.Time
			item.UpdateTime = &t
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}
