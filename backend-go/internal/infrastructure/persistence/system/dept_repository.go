package system

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	domainsys "voc-go-backend/internal/domain/system"

	"github.com/lib/pq"
)

// PgDeptRepository 提供 sys_dept 的 PostgreSQL 实现。
type PgDeptRepository struct {
	db *sql.DB
}

func NewPgDeptRepository(db *sql.DB) *PgDeptRepository {
	return &PgDeptRepository{db: db}
}

var _ domainsys.DeptRepository = (*PgDeptRepository)(nil)

func (r *PgDeptRepository) List(ctx context.Context, f domainsys.DeptListFilter) ([]domainsys.DeptDetail, error) {
	where := "WHERE 1=1"
	args := []any{}
	argPos := 1

	if strings.TrimSpace(f.Description) != "" {
		where += fmt.Sprintf(" AND (d.name ILIKE $%d OR COALESCE(d.description,'') ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+strings.TrimSpace(f.Description)+"%")
		argPos++
	}
	if f.Status != 0 {
		where += fmt.Sprintf(" AND d.status = $%d", argPos)
		args = append(args, f.Status)
		argPos++
	}

	query := `
SELECT d.id,
       d.name,
       d.parent_id,
       d.sort,
       d.status,
       d.is_system,
       COALESCE(d.description, ''),
       d.create_time,
       COALESCE(cu.nickname, ''),
       d.update_time,
       COALESCE(uu.nickname, '')
FROM sys_dept AS d
LEFT JOIN sys_user AS cu ON cu.id = d.create_user
LEFT JOIN sys_user AS uu ON uu.id = d.update_user
` + where + `
ORDER BY d.sort ASC, d.id ASC;
`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domainsys.DeptDetail
	for rows.Next() {
		var (
			d        domainsys.DeptDetail
			updateAt sql.NullTime
		)
		if err := rows.Scan(
			&d.ID,
			&d.Name,
			&d.ParentID,
			&d.Sort,
			&d.Status,
			&d.IsSystem,
			&d.Description,
			&d.CreateTime,
			&d.CreateUserString,
			&updateAt,
			&d.UpdateUserString,
		); err != nil {
			return nil, err
		}
		if updateAt.Valid {
			t := updateAt.Time
			d.UpdateTime = &t
		}
		list = append(list, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *PgDeptRepository) Get(ctx context.Context, id int64) (*domainsys.DeptDetail, error) {
	const query = `
SELECT d.id,
       d.name,
       d.parent_id,
       d.sort,
       d.status,
       d.is_system,
       COALESCE(d.description, ''),
       d.create_time,
       COALESCE(cu.nickname, ''),
       d.update_time,
       COALESCE(uu.nickname, '')
FROM sys_dept AS d
LEFT JOIN sys_user AS cu ON cu.id = d.create_user
LEFT JOIN sys_user AS uu ON uu.id = d.update_user
WHERE d.id = $1;
`

	var (
		d        domainsys.DeptDetail
		updateAt sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&d.ID,
		&d.Name,
		&d.ParentID,
		&d.Sort,
		&d.Status,
		&d.IsSystem,
		&d.Description,
		&d.CreateTime,
		&d.CreateUserString,
		&updateAt,
		&d.UpdateUserString,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if updateAt.Valid {
		t := updateAt.Time
		d.UpdateTime = &t
	}
	return &d, nil
}

func (r *PgDeptRepository) NameExistsUnderParent(ctx context.Context, parentID int64, name string, excludeID *int64) (bool, error) {
	where := "name = $1 AND parent_id = $2"
	args := []any{name, parentID}
	if excludeID != nil && *excludeID > 0 {
		where += " AND id <> $3"
		args = append(args, *excludeID)
	}
	q := "SELECT 1 FROM sys_dept WHERE " + where + " LIMIT 1;"
	var tmp int
	err := r.db.QueryRowContext(ctx, q, args...).Scan(&tmp)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *PgDeptRepository) Exists(ctx context.Context, id int64) (bool, error) {
	const q = `SELECT 1 FROM sys_dept WHERE id = $1 LIMIT 1;`
	var tmp int
	err := r.db.QueryRowContext(ctx, q, id).Scan(&tmp)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *PgDeptRepository) GetMeta(ctx context.Context, id int64) (name string, parentID int64, isSystem bool, err error) {
	const q = `SELECT name, parent_id, is_system FROM sys_dept WHERE id = $1;`
	err = r.db.QueryRowContext(ctx, q, id).Scan(&name, &parentID, &isSystem)
	if errors.Is(err, sql.ErrNoRows) {
		return "", 0, false, nil
	}
	return name, parentID, isSystem, err
}

func (r *PgDeptRepository) HasChildren(ctx context.Context, ids []int64) (bool, error) {
	const q = `SELECT 1 FROM sys_dept WHERE parent_id = ANY($1::bigint[]) LIMIT 1;`
	var tmp int
	err := r.db.QueryRowContext(ctx, q, pq.Int64Array(ids)).Scan(&tmp)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *PgDeptRepository) HasUsers(ctx context.Context, ids []int64) (bool, error) {
	const q = `SELECT 1 FROM sys_user WHERE dept_id = ANY($1::bigint[]) LIMIT 1;`
	var tmp int
	err := r.db.QueryRowContext(ctx, q, pq.Int64Array(ids)).Scan(&tmp)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *PgDeptRepository) FindSystemDeptName(ctx context.Context, ids []int64) (string, bool, error) {
	const q = `SELECT name FROM sys_dept WHERE id = ANY($1::bigint[]) AND is_system = TRUE LIMIT 1;`
	var name string
	err := r.db.QueryRowContext(ctx, q, pq.Int64Array(ids)).Scan(&name)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return name, true, nil
}

func (r *PgDeptRepository) Create(ctx context.Context, d *domainsys.Dept) error {
	const q = `
INSERT INTO sys_dept (
    id, name, parent_id, sort, status, is_system, description,
    create_user, create_time
) VALUES (
    $1, $2, $3, $4, $5, FALSE, $6,
    $7, $8
);
`
	_, err := r.db.ExecContext(
		ctx,
		q,
		d.ID,
		d.Name,
		d.ParentID,
		d.Sort,
		d.Status,
		strings.TrimSpace(d.Description),
		derefInt64(d.CreateUser),
		d.CreateTime,
	)
	return err
}

func (r *PgDeptRepository) Update(ctx context.Context, d *domainsys.Dept) error {
	const q = `
UPDATE sys_dept
   SET name = $1,
       parent_id = $2,
       sort = $3,
       status = $4,
       description = $5,
       update_user = $6,
       update_time = $7
 WHERE id = $8;
`
	_, err := r.db.ExecContext(
		ctx,
		q,
		d.Name,
		d.ParentID,
		d.Sort,
		d.Status,
		strings.TrimSpace(d.Description),
		derefInt64(d.UpdateUser),
		derefTime(d.UpdateTime),
		d.ID,
	)
	return err
}

func (r *PgDeptRepository) Delete(ctx context.Context, ids []int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_role_dept WHERE dept_id = ANY($1::bigint[])`, pq.Int64Array(ids)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM sys_dept WHERE id = ANY($1::bigint[])`, pq.Int64Array(ids)); err != nil {
		return err
	}
	return tx.Commit()
}

func derefInt64(v *int64) any {
	if v == nil {
		return nil
	}
	return *v
}

func derefTime(v *time.Time) any {
	if v == nil || v.IsZero() {
		return nil
	}
	return *v
}

