package syslog

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	domainsyslog "go-backend/internal/domain/syslog"
)

// PgQueryRepository 提供 sys_log 的查询实现。
type PgQueryRepository struct {
	db *sql.DB
}

func NewPgQueryRepository(db *sql.DB) *PgQueryRepository {
	return &PgQueryRepository{db: db}
}

var _ domainsyslog.QueryRepository = (*PgQueryRepository)(nil)

func (r *PgQueryRepository) Page(ctx context.Context, f domainsyslog.QueryFilter) ([]domainsyslog.ListItem, int64, error) {
	baseFrom, where, args := buildSyslogWhere(f)

	countSQL := "SELECT COUNT(*) " + baseFrom + where
	var total int64
	if err := r.db.QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domainsyslog.ListItem{}, 0, nil
	}

	offset := int64((f.Page - 1) * f.Size)
	limitPos := len(args) + 1
	offsetPos := len(args) + 2
	argsWithPage := append(args, int64(f.Size), offset)

	query := fmt.Sprintf(`
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
%s
%s
ORDER BY t1.create_time DESC, t1.id DESC
LIMIT $%d OFFSET $%d;
`, baseFrom, where, limitPos, offsetPos)

	rows, err := r.db.QueryContext(ctx, query, argsWithPage...)
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
WHERE t1.id = $1;
`

	var item domainsyslog.Detail
	err := r.db.QueryRowContext(ctx, query, id).Scan(
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

	rows, err := r.db.QueryContext(ctx, query, args...)
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
	argPos := 1

	if strings.TrimSpace(f.Description) != "" {
		where += fmt.Sprintf(" AND (t1.description ILIKE $%d OR t1.module ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+strings.TrimSpace(f.Description)+"%")
		argPos++
	}
	if strings.TrimSpace(f.Module) != "" {
		where += fmt.Sprintf(" AND t1.module = $%d", argPos)
		args = append(args, strings.TrimSpace(f.Module))
		argPos++
	}
	if strings.TrimSpace(f.IP) != "" {
		where += fmt.Sprintf(" AND (t1.ip ILIKE $%d OR t1.address ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+strings.TrimSpace(f.IP)+"%")
		argPos++
	}
	if strings.TrimSpace(f.CreateUser) != "" {
		where += fmt.Sprintf(" AND (t2.username ILIKE $%d OR t2.nickname ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+strings.TrimSpace(f.CreateUser)+"%")
		argPos++
	}
	if f.Status != 0 {
		where += fmt.Sprintf(" AND t1.status = $%d", argPos)
		args = append(args, f.Status)
		argPos++
	}
	if f.StartTime != nil && f.EndTime != nil {
		where += fmt.Sprintf(" AND t1.create_time BETWEEN $%d AND $%d", argPos, argPos+1)
		args = append(args, *f.StartTime, *f.EndTime)
		argPos += 2
	}
	_ = argPos
	return baseFrom, where, args
}
