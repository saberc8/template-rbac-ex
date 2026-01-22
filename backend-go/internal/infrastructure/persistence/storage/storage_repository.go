package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	domainstorage "go-backend/internal/domain/storage"
	"go-backend/internal/infrastructure/persistence/sqlutil"
)

// PgStorageRepository 提供 sys_storage 的 PostgreSQL 实现。
type PgStorageRepository struct {
	db      *sql.DB
	dialect string
}

func NewStorageRepository(db *sql.DB, dialect string) *PgStorageRepository {
	return &PgStorageRepository{db: db, dialect: dialect}
}

func NewPgStorageRepository(db *sql.DB) *PgStorageRepository {
	return NewStorageRepository(db, "postgres")
}

var _ domainstorage.StorageRepository = (*PgStorageRepository)(nil)

func (r *PgStorageRepository) List(ctx context.Context, f domainstorage.StorageListFilter) ([]domainstorage.StorageDetail, error) {
	where := "WHERE 1=1"
	args := []any{}

	if strings.TrimSpace(f.Description) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(f.Description)) + "%"
		where += " AND (LOWER(s.name) LIKE ? OR LOWER(s.code) LIKE ? OR LOWER(COALESCE(s.description,'')) LIKE ?)"
		args = append(args, like, like, like)
	}
	if f.Type != 0 {
		where += " AND s.type = ?"
		args = append(args, f.Type)
	}

	query := fmt.Sprintf(`
SELECT s.id,
       s.name,
       s.code,
       s.type,
       COALESCE(s.access_key, ''),
       COALESCE(s.secret_key, ''),
       COALESCE(s.region, ''),
       COALESCE(s.endpoint, ''),
       s.bucket_name,
       COALESCE(s.domain, ''),
       COALESCE(s.description, ''),
       s.is_default,
       COALESCE(s.sort, 999),
       s.status,
       s.create_time,
       COALESCE(cu.nickname, ''),
       s.update_time,
       COALESCE(uu.nickname, '')
FROM sys_storage AS s
LEFT JOIN sys_user AS cu ON cu.id = s.create_user
LEFT JOIN sys_user AS uu ON uu.id = s.update_user
%s
ORDER BY s.sort ASC, s.id ASC;
`, where)

	rows, err := r.db.QueryContext(ctx, sqlutil.Rebind(r.dialect, query), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domainstorage.StorageDetail
	for rows.Next() {
		var (
			item     domainstorage.StorageDetail
			updateAt sql.NullTime
		)
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Code,
			&item.Type,
			&item.AccessKey,
			&item.SecretKey,
			&item.Region,
			&item.Endpoint,
			&item.BucketName,
			&item.Domain,
			&item.Description,
			&item.IsDefault,
			&item.Sort,
			&item.Status,
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

func (r *PgStorageRepository) Get(ctx context.Context, id int64) (*domainstorage.StorageDetail, error) {
	const query = `
SELECT s.id,
       s.name,
       s.code,
       s.type,
       COALESCE(s.access_key, ''),
       COALESCE(s.secret_key, ''),
       COALESCE(s.endpoint, ''),
       COALESCE(s.region, ''),
       s.bucket_name,
       COALESCE(s.domain, ''),
       COALESCE(s.description, ''),
       s.is_default,
       COALESCE(s.sort, 999),
       s.status,
       s.create_time,
       COALESCE(cu.nickname, ''),
       s.update_time,
       COALESCE(uu.nickname, '')
FROM sys_storage AS s
LEFT JOIN sys_user AS cu ON cu.id = s.create_user
LEFT JOIN sys_user AS uu ON uu.id = s.update_user
WHERE s.id = ?;
`

	var (
		item     domainstorage.StorageDetail
		updateAt sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, query), id).Scan(
		&item.ID,
		&item.Name,
		&item.Code,
		&item.Type,
		&item.AccessKey,
		&item.SecretKey,
		&item.Endpoint,
		&item.Region,
		&item.BucketName,
		&item.Domain,
		&item.Description,
		&item.IsDefault,
		&item.Sort,
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
	return &item, nil
}

func (r *PgStorageRepository) GetDefault(ctx context.Context) (*domainstorage.StorageDetail, error) {
	const query = `
SELECT s.id,
       s.name,
       s.code,
       s.type,
       COALESCE(s.access_key, ''),
       COALESCE(s.secret_key, ''),
       COALESCE(s.endpoint, ''),
       COALESCE(s.region, ''),
       COALESCE(s.bucket_name, ''),
       COALESCE(s.domain, ''),
       COALESCE(s.description, ''),
       s.is_default,
       COALESCE(s.sort, 999),
       s.status,
       s.create_time,
       COALESCE(cu.nickname, ''),
       s.update_time,
       COALESCE(uu.nickname, '')
FROM sys_storage AS s
LEFT JOIN sys_user AS cu ON cu.id = s.create_user
LEFT JOIN sys_user AS uu ON uu.id = s.update_user
WHERE s.is_default = TRUE
LIMIT 1;
`

	var (
		item     domainstorage.StorageDetail
		updateAt sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, query).Scan(
		&item.ID,
		&item.Name,
		&item.Code,
		&item.Type,
		&item.AccessKey,
		&item.SecretKey,
		&item.Endpoint,
		&item.Region,
		&item.BucketName,
		&item.Domain,
		&item.Description,
		&item.IsDefault,
		&item.Sort,
		&item.Status,
		&item.CreateTime,
		&item.CreateUserString,
		&updateAt,
		&item.UpdateUserString,
	)
	if errors.Is(err, sql.ErrNoRows) {
		// 没有配置默认存储时，回退到本地存储，保持兼容原有逻辑。
		bucket := strings.TrimSpace(item.BucketName)
		if bucket == "" {
			bucket = "./data/file"
		}
		return &domainstorage.StorageDetail{
			Storage: domainstorage.Storage{
				ID:         1,
				Name:       "本地存储",
				Code:       "local",
				Type:       1,
				BucketName: bucket,
				IsDefault:  true,
				Status:     1,
				CreateTime: time.Now(),
			},
		}, nil
	}
	if err != nil {
		return nil, err
	}
	if item.Type == 1 && strings.TrimSpace(item.BucketName) == "" {
		item.BucketName = "./data/file"
	}
	if updateAt.Valid {
		t := updateAt.Time
		item.UpdateTime = &t
	}
	return &item, nil
}

func (r *PgStorageRepository) ListByIDs(ctx context.Context, ids []int64) ([]domainstorage.StorageDetail, error) {
	if len(ids) == 0 {
		return []domainstorage.StorageDetail{}, nil
	}
	query := `
SELECT s.id,
       s.name,
       s.code,
       s.type,
       COALESCE(s.access_key, ''),
       COALESCE(s.secret_key, ''),
       COALESCE(s.endpoint, ''),
       COALESCE(s.region, ''),
       COALESCE(s.bucket_name, ''),
       COALESCE(s.domain, ''),
       COALESCE(s.description, ''),
       s.is_default,
       COALESCE(s.sort, 999),
       s.status,
       s.create_time,
       COALESCE(cu.nickname, ''),
       s.update_time,
       COALESCE(uu.nickname, '')
FROM sys_storage AS s
LEFT JOIN sys_user AS cu ON cu.id = s.create_user
LEFT JOIN sys_user AS uu ON uu.id = s.update_user
WHERE s.id IN (?);
`
	sqlQuery, sqlArgs, err := sqlutil.In(r.dialect, query, ids)
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, sqlQuery, sqlArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domainstorage.StorageDetail
	for rows.Next() {
		var (
			item     domainstorage.StorageDetail
			updateAt sql.NullTime
		)
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Code,
			&item.Type,
			&item.AccessKey,
			&item.SecretKey,
			&item.Endpoint,
			&item.Region,
			&item.BucketName,
			&item.Domain,
			&item.Description,
			&item.IsDefault,
			&item.Sort,
			&item.Status,
			&item.CreateTime,
			&item.CreateUserString,
			&updateAt,
			&item.UpdateUserString,
		); err != nil {
			return nil, err
		}
		if item.Type == 1 && strings.TrimSpace(item.BucketName) == "" {
			item.BucketName = "./data/file"
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

func (r *PgStorageRepository) CodeExists(ctx context.Context, code string, excludeID *int64) (bool, error) {
	where := "code = ?"
	args := []any{code}
	if excludeID != nil && *excludeID > 0 {
		where += " AND id <> ?"
		args = append(args, *excludeID)
	}
	q := "SELECT 1 FROM sys_storage WHERE " + where + " LIMIT 1;"
	var tmp int
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, q), args...).Scan(&tmp)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *PgStorageRepository) Create(ctx context.Context, s *domainstorage.Storage) error {
	const stmt = `
INSERT INTO sys_storage (
    id, name, code, type, access_key, secret_key, endpoint,
    region,
    bucket_name, domain, description, is_default, sort, status,
    create_user, create_time
) VALUES (
    ?, ?, ?, ?, ?, ?, ?,
    ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?
);
`
	_, err := r.db.ExecContext(
		ctx,
		sqlutil.Rebind(r.dialect, stmt),
		s.ID,
		s.Name,
		s.Code,
		s.Type,
		s.AccessKey,
		s.SecretKey,
		s.Endpoint,
		s.Region,
		s.BucketName,
		s.Domain,
		s.Description,
		s.IsDefault,
		s.Sort,
		s.Status,
		derefInt64(s.CreateUser),
		s.CreateTime,
	)
	return err
}

func (r *PgStorageRepository) Update(ctx context.Context, s *domainstorage.Storage) error {
	const stmt = `
UPDATE sys_storage
   SET name = ?,
       code = ?,
       type = ?,
       access_key = ?,
       secret_key = ?,
       endpoint = ?,
       region = ?,
       bucket_name = ?,
       domain = ?,
       description = ?,
       is_default = ?,
       sort = ?,
       status = ?,
       update_user = ?,
       update_time = ?
 WHERE id = ?;
`
	_, err := r.db.ExecContext(
		ctx,
		sqlutil.Rebind(r.dialect, stmt),
		s.Name,
		s.Code,
		s.Type,
		s.AccessKey,
		s.SecretKey,
		s.Endpoint,
		s.Region,
		s.BucketName,
		s.Domain,
		s.Description,
		s.IsDefault,
		s.Sort,
		s.Status,
		derefInt64(s.UpdateUser),
		derefTime(s.UpdateTime),
		s.ID,
	)
	return err
}

func (r *PgStorageRepository) Delete(ctx context.Context, ids []int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, idVal := range ids {
		var isDefault bool
		if err := tx.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, `SELECT is_default FROM sys_storage WHERE id = ?`), idVal).Scan(&isDefault); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				continue
			}
			return err
		}
		if isDefault {
			return domainstorage.ErrDefaultStorage
		}
		if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, `DELETE FROM sys_storage WHERE id = ?`), idVal); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *PgStorageRepository) UpdateStatus(ctx context.Context, id int64, status int16, userID int64) error {
	const stmt = `
UPDATE sys_storage
   SET status = ?,
       update_user = ?,
       update_time = ?
 WHERE id = ?;
`
	_, err := r.db.ExecContext(ctx, sqlutil.Rebind(r.dialect, stmt), status, userID, time.Now(), id)
	return err
}

func (r *PgStorageRepository) SetDefault(ctx context.Context, id int64, userID int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `UPDATE sys_storage SET is_default = FALSE`); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, sqlutil.Rebind(r.dialect, `UPDATE sys_storage SET is_default = TRUE, update_user = ?, update_time = ? WHERE id = ?`), userID, time.Now(), id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *PgStorageRepository) ClearDefault(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `UPDATE sys_storage SET is_default = FALSE`)
	return err
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
