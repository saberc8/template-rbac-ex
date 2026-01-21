package client

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	domainclient "voc-go-backend/internal/domain/client"
)

// PgRepository 提供 sys_client 的 PostgreSQL 实现。
type PgRepository struct {
	db *sql.DB
}

func NewPgRepository(db *sql.DB) *PgRepository {
	return &PgRepository{db: db}
}

var _ domainclient.Repository = (*PgRepository)(nil)

func (r *PgRepository) Page(ctx context.Context, q domainclient.PageQuery) (domainclient.PageResult, error) {
	where := "WHERE 1=1"
	args := []any{}
	argPos := 1

	if strings.TrimSpace(q.ClientType) != "" {
		where += fmt.Sprintf(" AND c.client_type = $%d", argPos)
		args = append(args, strings.TrimSpace(q.ClientType))
		argPos++
	}
	if q.Status != nil {
		where += fmt.Sprintf(" AND c.status = $%d", argPos)
		args = append(args, *q.Status)
		argPos++
	}
	if len(q.AuthType) > 0 {
		// 任意一个认证类型命中即可。
		conds := make([]string, 0, len(q.AuthType))
		for _, t := range q.AuthType {
			t = strings.TrimSpace(t)
			if t == "" {
				continue
			}
			conds = append(conds, fmt.Sprintf("c.auth_type::jsonb @> $%d::jsonb", argPos))
			b, _ := json.Marshal([]string{t})
			args = append(args, string(b))
			argPos++
		}
		if len(conds) > 0 {
			where += " AND (" + strings.Join(conds, " OR ") + ")"
		}
	}

	countSQL := "SELECT COUNT(*) FROM sys_client AS c " + where
	var total int64
	if err := r.db.QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return domainclient.PageResult{}, err
	}
	if total == 0 {
		return domainclient.PageResult{List: []domainclient.ClientDetail{}, Total: 0}, nil
	}

	offset := int64((q.Page - 1) * q.Size)
	limitPos := argPos
	offsetPos := argPos + 1
	argsWithPage := append(args, int64(q.Size), offset)

	query := fmt.Sprintf(`
SELECT c.id,
       c.client_id,
       c.client_type,
       c.auth_type,
       c.active_timeout,
       c.timeout,
       c.status,
       c.create_time,
       COALESCE(cu.nickname, ''),
       c.update_time,
       COALESCE(uu.nickname, '')
FROM sys_client AS c
LEFT JOIN sys_user AS cu ON cu.id = c.create_user
LEFT JOIN sys_user AS uu ON uu.id = c.update_user
%s
ORDER BY c.id DESC
LIMIT $%d OFFSET $%d;
`, where, limitPos, offsetPos)

	rows, err := r.db.QueryContext(ctx, query, argsWithPage...)
	if err != nil {
		return domainclient.PageResult{}, err
	}
	defer rows.Close()

	list := make([]domainclient.ClientDetail, 0, q.Size)
	for rows.Next() {
		var (
			item     domainclient.ClientDetail
			authRaw  []byte
			updateAt sql.NullTime
		)
		if err := rows.Scan(
			&item.ID,
			&item.ClientID,
			&item.ClientType,
			&authRaw,
			&item.ActiveTimeout,
			&item.Timeout,
			&item.Status,
			&item.CreateTime,
			&item.CreateUserString,
			&updateAt,
			&item.UpdateUserString,
		); err != nil {
			return domainclient.PageResult{}, err
		}
		if updateAt.Valid {
			t := updateAt.Time
			item.UpdateTime = &t
		}
		if len(authRaw) > 0 {
			_ = json.Unmarshal(authRaw, &item.AuthType)
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return domainclient.PageResult{}, err
	}
	return domainclient.PageResult{List: list, Total: total}, nil
}

func (r *PgRepository) Get(ctx context.Context, id int64) (*domainclient.ClientDetail, error) {
	const query = `
SELECT c.id,
       c.client_id,
       c.client_type,
       c.auth_type,
       c.active_timeout,
       c.timeout,
       c.status,
       c.create_time,
       COALESCE(cu.nickname, ''),
       c.update_time,
       COALESCE(uu.nickname, '')
FROM sys_client AS c
LEFT JOIN sys_user AS cu ON cu.id = c.create_user
LEFT JOIN sys_user AS uu ON uu.id = c.update_user
WHERE c.id = $1;
`

	var (
		item     domainclient.ClientDetail
		authRaw  []byte
		updateAt sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&item.ID,
		&item.ClientID,
		&item.ClientType,
		&authRaw,
		&item.ActiveTimeout,
		&item.Timeout,
		&item.Status,
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
	if len(authRaw) > 0 {
		_ = json.Unmarshal(authRaw, &item.AuthType)
	}
	return &item, nil
}

func (r *PgRepository) Create(ctx context.Context, c *domainclient.Client) error {
	authJSON, err := json.Marshal(c.AuthType)
	if err != nil {
		return err
	}

	const stmt = `
INSERT INTO sys_client (
    id, client_id, client_type, auth_type,
    active_timeout, timeout, status,
    create_user, create_time
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7,
    $8, $9
);
`
	_, err = r.db.ExecContext(
		ctx,
		stmt,
		c.ID,
		c.ClientID,
		c.ClientType,
		string(authJSON),
		c.ActiveTimeout,
		c.Timeout,
		c.Status,
		derefInt64(c.CreateUser),
		c.CreateTime,
	)
	return err
}

func (r *PgRepository) Update(ctx context.Context, c *domainclient.Client) error {
	authJSON, err := json.Marshal(c.AuthType)
	if err != nil {
		return err
	}

	const stmt = `
UPDATE sys_client
   SET client_type = $1,
       auth_type = $2,
       active_timeout = $3,
       timeout = $4,
       status = $5,
       update_user = $6,
       update_time = $7
 WHERE id = $8;
`
	_, err = r.db.ExecContext(
		ctx,
		stmt,
		c.ClientType,
		string(authJSON),
		c.ActiveTimeout,
		c.Timeout,
		c.Status,
		derefInt64(c.UpdateUser),
		derefTime(c.UpdateTime),
		c.ID,
	)
	return err
}

func (r *PgRepository) Delete(ctx context.Context, ids []int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, idVal := range ids {
		if _, err := tx.ExecContext(ctx, `DELETE FROM sys_client WHERE id = $1`, idVal); err != nil {
			return err
		}
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

