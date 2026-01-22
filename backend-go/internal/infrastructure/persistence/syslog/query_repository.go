package syslog

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	domainsyslog "go-backend/internal/domain/syslog"
	"go-backend/internal/infrastructure/persistence/sqlutil"
)

// PgQueryRepository 提供 sys_log 的查询实现。
type PgQueryRepository struct {
	db      *sql.DB
	dialect string
}

func NewQueryRepository(db *sql.DB, dialect string) *PgQueryRepository {
	return &PgQueryRepository{db: db, dialect: dialect}
}

func NewPgQueryRepository(db *sql.DB) *PgQueryRepository {
	return NewQueryRepository(db, "postgres")
}

var _ domainsyslog.QueryRepository = (*PgQueryRepository)(nil)

func (r *PgQueryRepository) Page(ctx context.Context, f domainsyslog.QueryFilter) ([]domainsyslog.ListItem, int64, error) {
	baseFrom, where, args := buildSyslogWhere(f)

	countSQL := "SELECT COUNT(*) " + baseFrom + where
	var total int64
	if err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, countSQL), args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domainsyslog.ListItem{}, 0, nil
	}

	offset := int64((f.Page - 1) * f.Size)
	argsWithPage := append(args, int64(f.Size), offset)

	query := `
SELECT t1.id,
       t1.description,
       t1.module,
       COALESCE(t1.time_taken, 0),
       COALESCE(t1.ip, ''),
       COALESCE(t1.address, ''),
       COALESCE(t1.browser, ''),
       COALESCE(t1.os, ''),
       COALESCE(t1.status, 1),
       COALESCE(t1.error_msg, ''),
       t1.create_time,
       COALESCE(t2.nickname, '')
` + baseFrom + where + `
ORDER BY t1.create_time DESC, t1.id DESC
LIMIT ? OFFSET ?;
`

	rows, err := r.db.QueryContext(ctx, sqlutil.Rebind(r.dialect, query), argsWithPage...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	list := make([]domainsyslog.ListItem, 0, f.Size)
	for rows.Next() {
		var item domainsyslog.ListItem
		if err := rows.Scan(
			&item.ID,
			&item.Description,
			&item.Module,
			&item.TimeTaken,
			&item.IP,
			&item.Address,
			&item.Browser,
			&item.OS,
			&item.Status,
			&item.ErrorMsg,
			&item.CreateTime,
			&item.CreateUserString,
		); err != nil {
			return nil, 0, err
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *PgQueryRepository) Get(ctx context.Context, id int64) (*domainsyslog.Detail, error) {
	const query = `
SELECT t1.id,
       COALESCE(t1.trace_id, ''),
       t1.description,
       t1.module,
       t1.request_url,
       t1.request_method,
       COALESCE(t1.request_headers, ''),
       COALESCE(t1.request_body, ''),
       t1.status_code,
       COALESCE(t1.response_headers, ''),
       COALESCE(t1.response_body, ''),
       COALESCE(t1.time_taken, 0),
       COALESCE(t1.ip, ''),
       COALESCE(t1.address, ''),
       COALESCE(t1.browser, ''),
       COALESCE(t1.os, ''),
       COALESCE(t1.status, 1),
       COALESCE(t1.error_msg, ''),
       t1.create_time,
       COALESCE(t2.nickname, '')
FROM sys_log AS t1
LEFT JOIN sys_user AS t2 ON t2.id = t1.create_user
WHERE t1.id = ?;
`

	var item domainsyslog.Detail
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, query), id).Scan(
		&item.ID,
		&item.TraceID,
		&item.Description,
		&item.Module,
		&item.RequestURL,
		&item.RequestMethod,
		&item.RequestHeaders,
		&item.RequestBody,
		&item.StatusCode,
		&item.ResponseHeaders,
		&item.ResponseBody,
		&item.TimeTaken,
		&item.IP,
		&item.Address,
		&item.Browser,
		&item.OS,
		&item.Status,
		&item.ErrorMsg,
		&item.CreateTime,
		&item.CreateUserString,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *PgQueryRepository) ListForExport(ctx context.Context, f domainsyslog.QueryFilter) ([]domainsyslog.ListItem, error) {
	baseFrom, where, args := buildSyslogWhere(f)

	query := `
SELECT t1.id,
       t1.description,
       t1.module,
       COALESCE(t1.time_taken, 0),
       COALESCE(t1.ip, ''),
       COALESCE(t1.address, ''),
       COALESCE(t1.browser, ''),
       COALESCE(t1.os, ''),
       COALESCE(t1.status, 1),
       COALESCE(t1.error_msg, ''),
       t1.create_time,
       COALESCE(t2.nickname, '')
` + baseFrom + where + " ORDER BY t1.create_time DESC, t1.id DESC;"

	rows, err := r.db.QueryContext(ctx, sqlutil.Rebind(r.dialect, query), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domainsyslog.ListItem
	for rows.Next() {
		var item domainsyslog.ListItem
		if err := rows.Scan(
			&item.ID,
			&item.Description,
			&item.Module,
			&item.TimeTaken,
			&item.IP,
			&item.Address,
			&item.Browser,
			&item.OS,
			&item.Status,
			&item.ErrorMsg,
			&item.CreateTime,
			&item.CreateUserString,
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

func buildSyslogWhere(f domainsyslog.QueryFilter) (baseFrom string, where string, args []any) {
	baseFrom = `
FROM sys_log AS t1
LEFT JOIN sys_user AS t2 ON t2.id = t1.create_user
`
	where = "WHERE 1=1"
	args = []any{}

	if strings.TrimSpace(f.Description) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(f.Description)) + "%"
		where += " AND (LOWER(t1.description) LIKE ? OR LOWER(t1.module) LIKE ?)"
		args = append(args, like, like)
	}
	if strings.TrimSpace(f.Module) != "" {
		where += " AND t1.module = ?"
		args = append(args, strings.TrimSpace(f.Module))
	}
	if strings.TrimSpace(f.IP) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(f.IP)) + "%"
		where += " AND (LOWER(t1.ip) LIKE ? OR LOWER(t1.address) LIKE ?)"
		args = append(args, like, like)
	}
	if strings.TrimSpace(f.CreateUser) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(f.CreateUser)) + "%"
		where += " AND (LOWER(t2.username) LIKE ? OR LOWER(t2.nickname) LIKE ?)"
		args = append(args, like, like)
	}
	if f.Status != 0 {
		where += " AND t1.status = ?"
		args = append(args, f.Status)
	}
	if f.StartTime != nil && f.EndTime != nil {
		where += " AND t1.create_time BETWEEN ? AND ?"
		args = append(args, *f.StartTime, *f.EndTime)
	}
	return baseFrom, where, args
}
