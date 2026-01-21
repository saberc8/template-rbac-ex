package system

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	domainsys "voc-go-backend/internal/domain/system"
)

// PgOptionRepository 提供 sys_option 的 PostgreSQL 实现。
type PgOptionRepository struct {
	db *sql.DB
}

func NewPgOptionRepository(db *sql.DB) *PgOptionRepository {
	return &PgOptionRepository{db: db}
}

var _ domainsys.OptionRepository = (*PgOptionRepository)(nil)

func (r *PgOptionRepository) GetMergedValue(ctx context.Context, code string) (string, bool, error) {
	const q = `
SELECT COALESCE(value, default_value, '') AS val
FROM sys_option
WHERE code = $1
LIMIT 1;
`
	var val string
	err := r.db.QueryRowContext(ctx, q, strings.TrimSpace(code)).Scan(&val)
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
	argPos := 1

	if len(f.Codes) > 0 {
		placeholders := make([]string, 0, len(f.Codes))
		for _, code := range f.Codes {
			code = strings.TrimSpace(code)
			if code == "" {
				continue
			}
			placeholders = append(placeholders, "$"+strconv.Itoa(argPos))
			args = append(args, code)
			argPos++
		}
		if len(placeholders) > 0 {
			where += " AND code IN (" + strings.Join(placeholders, ",") + ")"
		}
	}
	if strings.TrimSpace(f.Category) != "" {
		where += fmt.Sprintf(" AND category = $%d", argPos)
		args = append(args, strings.TrimSpace(f.Category))
		argPos++
	}

	query := `
SELECT id, name, code,
       COALESCE(value, default_value, '') AS value,
       COALESCE(description, '')
FROM sys_option
` + where + `
ORDER BY id ASC;
`

	rows, err := r.db.QueryContext(ctx, query, args...)
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
   SET value = $1,
       update_user = $2,
       update_time = $3
 WHERE id = $4 AND code = $5;
`
	now := time.Now()
	for _, u := range updates {
		if _, err := tx.ExecContext(ctx, stmt, u.Value, userID, now, u.ID, u.Code); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *PgOptionRepository) ResetValues(ctx context.Context, f domainsys.OptionResetFilter) error {
	where := ""
	args := []any{}
	argPos := 1
	if strings.TrimSpace(f.Category) != "" {
		where = fmt.Sprintf("category = $%d", argPos)
		args = append(args, strings.TrimSpace(f.Category))
		argPos++
	} else if len(f.Codes) > 0 {
		placeholders := make([]string, 0, len(f.Codes))
		for _, code := range f.Codes {
			code = strings.TrimSpace(code)
			if code == "" {
				continue
			}
			placeholders = append(placeholders, "$"+strconv.Itoa(argPos))
			args = append(args, code)
			argPos++
		}
		if len(placeholders) > 0 {
			where = "code IN (" + strings.Join(placeholders, ",") + ")"
		}
	}

	stmt := "UPDATE sys_option SET value = NULL"
	if where != "" {
		stmt += " WHERE " + where
	}
	_, err := r.db.ExecContext(ctx, stmt, args...)
	return err
}
