package dict

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	domaindict "go-backend/internal/domain/dict"

	"github.com/lib/pq"
)

type PgRepository struct {
	db *sql.DB
}

func NewPgRepository(db *sql.DB) *PgRepository {
	return &PgRepository{db: db}
}

var _ domaindict.Repository = (*PgRepository)(nil)

func (r *PgRepository) ListDict(ctx context.Context, description string) ([]domaindict.Dict, error) {
	args := []any{}
	where := ""
	if description != "" {
		where = "WHERE (d.name ILIKE $1 OR COALESCE(d.description,'') ILIKE $1)"
		args = append(args, "%"+description+"%")
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

	rows, err := r.db.QueryContext(ctx, query, args...)
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
WHERE d.id = $1;
`
	var (
		item     domaindict.Dict
		updateAt sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, query, id).Scan(
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
	const q = `SELECT 1 FROM sys_dict WHERE name = $1 LIMIT 1;`
	var tmp int
	err := r.db.QueryRowContext(ctx, q, name).Scan(&tmp)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *PgRepository) DictCodeExists(ctx context.Context, code string) (bool, error) {
	const q = `SELECT 1 FROM sys_dict WHERE code = $1 LIMIT 1;`
	var tmp int
	err := r.db.QueryRowContext(ctx, q, code).Scan(&tmp)
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
VALUES ($1, $2, $3, $4, FALSE, $5, $6);
`
	_, err := r.db.ExecContext(ctx, stmt, id, name, code, description, userID, now)
	return err
}

func (r *PgRepository) UpdateDict(ctx context.Context, id int64, name, description string, userID int64, now time.Time) error {
	const stmt = `
UPDATE sys_dict
   SET name = $1,
       description = $2,
       update_user = $3,
       update_time = $4
 WHERE id = $5;
`
	_, err := r.db.ExecContext(ctx, stmt, name, description, userID, now, id)
	return err
}

func (r *PgRepository) DeleteDict(ctx context.Context, ids []int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_dict_item WHERE dict_id = ANY($1::bigint[])`, pq.Int64Array(ids)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_dict WHERE id = ANY($1::bigint[])`, pq.Int64Array(ids)); err != nil {
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
	argPos := 1

	if q.DictID != nil && *q.DictID != 0 {
		where += fmt.Sprintf(" AND di.dict_id = $%d", argPos)
		args = append(args, *q.DictID)
		argPos++
	}
	if strings.TrimSpace(q.Description) != "" {
		where += fmt.Sprintf(" AND (di.label ILIKE $%d OR COALESCE(di.description,'') ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+strings.TrimSpace(q.Description)+"%")
		argPos++
	}
	if q.Status != nil && *q.Status != 0 {
		where += fmt.Sprintf(" AND di.status = $%d", argPos)
		args = append(args, *q.Status)
		argPos++
	}

	countSQL := "SELECT COUNT(*) " + baseFrom + where
	var total int64
	if err := r.db.QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domaindict.DictItem{}, 0, nil
	}

	offset := int64((q.Page - 1) * q.Size)
	limitPos := argPos
	offsetPos := argPos + 1
	argsWithPage := append(args, int64(q.Size), offset)

	query := fmt.Sprintf(`
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
%s
%s
ORDER BY di.sort ASC, di.id ASC
LIMIT $%d OFFSET $%d;
`, baseFrom, where, limitPos, offsetPos)

	rows, err := r.db.QueryContext(ctx, query, argsWithPage...)
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
WHERE di.id = $1;
`
	var (
		item     domaindict.DictItem
		updateAt sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, query, id).Scan(
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
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
`
	_, err := r.db.ExecContext(
		ctx,
		stmt,
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
   SET label       = $1,
       value       = $2,
       color       = $3,
       sort        = $4,
       description = $5,
       status      = $6,
       update_user = $7,
       update_time = $8
 WHERE id          = $9;
`
	_, err := r.db.ExecContext(
		ctx,
		stmt,
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
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_dict_item WHERE id = ANY($1::bigint[])`, pq.Int64Array(ids)); err != nil {
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
  AND t2.code = $1
ORDER BY t1.sort ASC, t1.id ASC;
`
	rows, err := r.db.QueryContext(ctx, query, strings.TrimSpace(code))
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
