package system

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	domainsys "go-backend/internal/domain/system"
	"go-backend/internal/infrastructure/persistence/sqlutil"
)

// PgOptionRepository 提供 sys_option 的 PostgreSQL 实现。
type PgOptionRepository struct {
	db      *sql.DB
	dialect string
}

func NewOptionRepository(db *sql.DB, dialect string) *PgOptionRepository {
	return &PgOptionRepository{db: db, dialect: dialect}
}

func NewPgOptionRepository(db *sql.DB) *PgOptionRepository {
	return NewOptionRepository(db, "postgres")
}

var _ domainsys.OptionRepository = (*PgOptionRepository)(nil)

func (r *PgOptionRepository) GetMergedValue(ctx context.Context, code string) (string, bool, error) {
	const q = `
SELECT COALESCE(value, default_value, '') AS val
FROM sys_option
WHERE code = ?
LIMIT 1;
`
	var val string
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, q), strings.TrimSpace(code)).Scan(&val)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return strings.TrimSpace(val), true, nil
}

func (r *PgOptionRepository) List(ctx context.Context, f domainsys.OptionListFilter) ([]domainsys.OptionView, error) {
	where := "WHERE 1=1"
	args := []any{}
	var codes []string

	if len(f.Codes) > 0 {
		for _, code := range f.Codes {
			code = strings.TrimSpace(code)
			if code == "" {
				continue
			}
			codes = append(codes, code)
		}
	}
	if strings.TrimSpace(f.Category) != "" {
		where += " AND category = ?"
		args = append(args, strings.TrimSpace(f.Category))
	}
	if len(codes) > 0 {
		where += " AND code IN (?)"
		args = append(args, codes)
	}

	query := `
SELECT id, name, code,
       COALESCE(value, default_value, '') AS value,
       COALESCE(description, '')
FROM sys_option
` + where + `
ORDER BY id ASC;
`

	var (
		sqlQuery string
		sqlArgs  []any
		err      error
	)
	if len(codes) > 0 {
		sqlQuery, sqlArgs, err = sqlutil.In(r.dialect, query, args...)
	} else {
		sqlQuery = sqlutil.Rebind(r.dialect, query)
		sqlArgs = args
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, sqlQuery, sqlArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domainsys.OptionView
	for rows.Next() {
		var item domainsys.OptionView
		if err := rows.Scan(&item.ID, &item.Name, &item.Code, &item.Value, &item.Description); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *PgOptionRepository) UpdateValues(ctx context.Context, userID int64, updates []domainsys.OptionUpdate) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	const stmt = `
UPDATE sys_option
   SET value = ?,
       update_user = ?,
       update_time = ?
 WHERE id = ? AND code = ?;
`
	now := time.Now()
	for _, u := range updates {
		if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, stmt), u.Value, userID, now, u.ID, u.Code); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *PgOptionRepository) ResetValues(ctx context.Context, f domainsys.OptionResetFilter) error {
	stmt := "UPDATE sys_option SET value = NULL"
	args := []any{}
	cat := strings.TrimSpace(f.Category)
	if cat != "" {
		stmt += " WHERE category = ?"
		args = append(args, cat)
		q := sqlutil.Rebind(r.dialect, stmt)
		_, err := r.db.ExecContext(ctx, q, args...)
		return err
	}

	var codes []string
	for _, code := range f.Codes {
		code = strings.TrimSpace(code)
		if code == "" {
			continue
		}
		codes = append(codes, code)
	}
	if len(codes) == 0 {
		_, err := r.db.ExecContext(ctx, stmt)
		return err
	}

	stmt += " WHERE code IN (?)"
	q, sqlArgs, err := sqlutil.In(r.dialect, stmt, codes)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, q, sqlArgs...)
	return err
}
