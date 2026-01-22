package storage

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	domainstorage "go-backend/internal/domain/storage"
	"go-backend/internal/infrastructure/persistence/sqlutil"
)

// PgFileRepository 提供 sys_file 的 PostgreSQL 实现。
type PgFileRepository struct {
	db      *sql.DB
	dialect string
}

func NewFileRepository(db *sql.DB, dialect string) *PgFileRepository {
	return &PgFileRepository{db: db, dialect: dialect}
}

func NewPgFileRepository(db *sql.DB) *PgFileRepository {
	return NewFileRepository(db, "postgres")
}

var _ domainstorage.FileRepository = (*PgFileRepository)(nil)

func (r *PgFileRepository) Page(ctx context.Context, q domainstorage.FilePageQuery) ([]domainstorage.FileDetail, int64, error) {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Size <= 0 {
		q.Size = 30
	}

	where := "WHERE 1=1"
	args := []any{}

	if strings.TrimSpace(q.OriginalName) != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(q.OriginalName)) + "%"
		where += " AND LOWER(f.original_name) LIKE ?"
		args = append(args, like)
	}
	if q.Type != 0 {
		where += " AND f.type = ?"
		args = append(args, q.Type)
	}
	if strings.TrimSpace(q.ParentPath) != "" {
		where += " AND f.parent_path = ?"
		args = append(args, strings.TrimSpace(q.ParentPath))
	}

	countSQL := "SELECT COUNT(*) FROM sys_file AS f " + where
	var total int64
	if err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, countSQL), args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domainstorage.FileDetail{}, 0, nil
	}

	offset := int64((q.Page - 1) * q.Size)
	argsWithPage := append(args, int64(q.Size), offset)

	query := `
SELECT f.id,
       f.name,
       f.original_name,
       f.size,
       f.parent_path,
       f.path,
       COALESCE(f.extension, ''),
       COALESCE(f.content_type, ''),
       f.type,
       COALESCE(f.sha256, ''),
       COALESCE(f.metadata, ''),
       COALESCE(f.thumbnail_name, ''),
       f.thumbnail_size,
       COALESCE(f.thumbnail_metadata, ''),
       f.storage_id,
       COALESCE(s.name, ''),
       f.create_time,
       COALESCE(cu.nickname, ''),
       f.update_time,
       COALESCE(uu.nickname, '')
FROM sys_file AS f
LEFT JOIN sys_user AS cu ON cu.id = f.create_user
LEFT JOIN sys_user AS uu ON uu.id = f.update_user
LEFT JOIN sys_storage AS s ON s.id = f.storage_id
` + where + `
ORDER BY f.type ASC, (f.update_time IS NULL) ASC, f.update_time DESC, f.id DESC
LIMIT ? OFFSET ?;
`

	rows, err := r.db.QueryContext(ctx, sqlutil.Rebind(r.dialect, query), argsWithPage...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	list := make([]domainstorage.FileDetail, 0, q.Size)
	for rows.Next() {
		var (
			item        domainstorage.FileDetail
			sizeVal     sql.NullInt64
			thumbSize   sql.NullInt64
			updateAt    sql.NullTime
			updateUser  sql.NullInt64
			createUser  sql.NullInt64
			thumbMeta   string
			metadata    string
			contentType string
			extension   string
		)
		_ = updateUser
		_ = createUser
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.OriginalName,
			&sizeVal,
			&item.ParentPath,
			&item.Path,
			&extension,
			&contentType,
			&item.Type,
			&item.Sha256,
			&metadata,
			&item.ThumbnailName,
			&thumbSize,
			&thumbMeta,
			&item.StorageID,
			&item.StorageName,
			&item.CreateTime,
			&item.CreateUserString,
			&updateAt,
			&item.UpdateUserString,
		); err != nil {
			return nil, 0, err
		}
		item.Extension = extension
		item.ContentType = contentType
		item.Metadata = metadata
		item.ThumbnailMeta = thumbMeta
		if sizeVal.Valid {
			v := sizeVal.Int64
			item.Size = &v
		}
		if thumbSize.Valid {
			v := thumbSize.Int64
			item.ThumbnailSize = &v
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

func (r *PgFileRepository) Get(ctx context.Context, id int64) (*domainstorage.FileDetail, error) {
	const query = `
SELECT f.id,
       f.name,
       f.original_name,
       f.size,
       f.parent_path,
       f.path,
       COALESCE(f.extension, ''),
       COALESCE(f.content_type, ''),
       f.type,
       COALESCE(f.sha256, ''),
       COALESCE(f.metadata, ''),
       COALESCE(f.thumbnail_name, ''),
       f.thumbnail_size,
       COALESCE(f.thumbnail_metadata, ''),
       f.storage_id,
       COALESCE(s.name, ''),
       f.create_time,
       COALESCE(cu.nickname, ''),
       f.update_time,
       COALESCE(uu.nickname, '')
FROM sys_file AS f
LEFT JOIN sys_user AS cu ON cu.id = f.create_user
LEFT JOIN sys_user AS uu ON uu.id = f.update_user
LEFT JOIN sys_storage AS s ON s.id = f.storage_id
WHERE f.id = ?;
`

	var (
		item      domainstorage.FileDetail
		sizeVal   sql.NullInt64
		thumbSize sql.NullInt64
		updateAt  sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, query), id).Scan(
		&item.ID,
		&item.Name,
		&item.OriginalName,
		&sizeVal,
		&item.ParentPath,
		&item.Path,
		&item.Extension,
		&item.ContentType,
		&item.Type,
		&item.Sha256,
		&item.Metadata,
		&item.ThumbnailName,
		&thumbSize,
		&item.ThumbnailMeta,
		&item.StorageID,
		&item.StorageName,
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
	if sizeVal.Valid {
		v := sizeVal.Int64
		item.Size = &v
	}
	if thumbSize.Valid {
		v := thumbSize.Int64
		item.ThumbnailSize = &v
	}
	if updateAt.Valid {
		t := updateAt.Time
		item.UpdateTime = &t
	}
	return &item, nil
}

func (r *PgFileRepository) GetByHash(ctx context.Context, sha256 string) (*domainstorage.FileDetail, error) {
	const query = `
SELECT f.id,
       f.name,
       f.original_name,
       f.size,
       f.parent_path,
       f.path,
       COALESCE(f.extension, ''),
       COALESCE(f.content_type, ''),
       f.type,
       COALESCE(f.sha256, ''),
       COALESCE(f.metadata, ''),
       COALESCE(f.thumbnail_name, ''),
       f.thumbnail_size,
       COALESCE(f.thumbnail_metadata, ''),
       f.storage_id,
       COALESCE(s.name, ''),
       f.create_time,
       COALESCE(cu.nickname, ''),
       f.update_time,
       COALESCE(uu.nickname, '')
FROM sys_file AS f
LEFT JOIN sys_user AS cu ON cu.id = f.create_user
LEFT JOIN sys_user AS uu ON uu.id = f.update_user
LEFT JOIN sys_storage AS s ON s.id = f.storage_id
WHERE f.sha256 = ?
LIMIT 1;
`
	var (
		item      domainstorage.FileDetail
		sizeVal   sql.NullInt64
		thumbSize sql.NullInt64
		updateAt  sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, query), strings.TrimSpace(sha256)).Scan(
		&item.ID,
		&item.Name,
		&item.OriginalName,
		&sizeVal,
		&item.ParentPath,
		&item.Path,
		&item.Extension,
		&item.ContentType,
		&item.Type,
		&item.Sha256,
		&item.Metadata,
		&item.ThumbnailName,
		&thumbSize,
		&item.ThumbnailMeta,
		&item.StorageID,
		&item.StorageName,
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
	if sizeVal.Valid {
		v := sizeVal.Int64
		item.Size = &v
	}
	if thumbSize.Valid {
		v := thumbSize.Int64
		item.ThumbnailSize = &v
	}
	if updateAt.Valid {
		t := updateAt.Time
		item.UpdateTime = &t
	}
	return &item, nil
}

func (r *PgFileRepository) DirExists(ctx context.Context, parentPath, name string) (bool, error) {
	const q = `
SELECT 1 FROM sys_file
WHERE parent_path = ? AND name = ? AND type = 0
LIMIT 1;
`
	var tmp int
	err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, q), parentPath, name).Scan(&tmp)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *PgFileRepository) CreateDir(ctx context.Context, dir *domainstorage.File) error {
	const insertSQL = `
INSERT INTO sys_file (
    id, name, original_name, size, parent_path, path, extension, content_type,
    type, sha256, metadata, thumbnail_name, thumbnail_size, thumbnail_metadata,
    storage_id, create_user, create_time
) VALUES (
    ?, ?, ?, NULL, ?, ?, NULL, NULL,
    0, '', '', '', NULL, '',
    ?, ?, ?
);`
	_, err := r.db.ExecContext(
		ctx,
		sqlutil.Rebind(r.dialect, insertSQL),
		dir.ID,
		dir.Name,
		dir.OriginalName,
		dir.ParentPath,
		dir.Path,
		dir.StorageID,
		derefInt64Ptr(dir.CreateUser),
		dir.CreateTime,
	)
	return err
}

func (r *PgFileRepository) CreateFile(ctx context.Context, f *domainstorage.File) error {
	const insertSQL = `
INSERT INTO sys_file (
    id, name, original_name, size, parent_path, path, extension, content_type,
    type, sha256, metadata, thumbnail_name, thumbnail_size, thumbnail_metadata,
    storage_id, create_user, create_time
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?
);`
	_, err := r.db.ExecContext(
		ctx,
		sqlutil.Rebind(r.dialect, insertSQL),
		f.ID,
		f.Name,
		f.OriginalName,
		derefInt64Ptr(f.Size),
		f.ParentPath,
		f.Path,
		nilIfBlank(f.Extension),
		nilIfBlank(f.ContentType),
		f.Type,
		f.Sha256,
		nilIfBlank(f.Metadata),
		nilIfBlank(f.ThumbnailName),
		derefInt64Ptr(f.ThumbnailSize),
		nilIfBlank(f.ThumbnailMeta),
		f.StorageID,
		derefInt64Ptr(f.CreateUser),
		f.CreateTime,
	)
	return err
}

func (r *PgFileRepository) UpdateOriginalName(ctx context.Context, id int64, originalName string, userID int64) error {
	const q = `
UPDATE sys_file
   SET original_name = ?,
       update_user   = ?,
       update_time   = ?
 WHERE id            = ?;
`
	_, err := r.db.ExecContext(ctx, sqlutil.Rebind(r.dialect, q), originalName, userID, time.Now(), id)
	return err
}

func (r *PgFileRepository) SumSizeByPathPrefix(ctx context.Context, prefix string) (int64, error) {
	const q = `
SELECT COALESCE(SUM(size), 0)
FROM sys_file
WHERE type <> 0 AND path LIKE ?;
`
	var total int64
	if err := r.db.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, q), prefix).Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func (r *PgFileRepository) Statistics(ctx context.Context) ([]domainstorage.FileStatItem, error) {
	const q = `
SELECT type, COUNT(1) AS number, COALESCE(SUM(size), 0) AS size
FROM sys_file
WHERE type <> 0
GROUP BY type;
`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domainstorage.FileStatItem
	for rows.Next() {
		var item domainstorage.FileStatItem
		if err := rows.Scan(&item.Type, &item.Number, &item.Size); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *PgFileRepository) DeleteWithChecks(ctx context.Context, ids []int64) ([]domainstorage.FileDeleteTarget, error) {
	if len(ids) == 0 {
		return []domainstorage.FileDeleteTarget{}, nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	type fileRow struct {
		id        int64
		name      string
		path      string
		fileType  int16
		storageID int64
	}

	var toDelete []domainstorage.FileDeleteTarget
	for _, idVal := range ids {
		var row fileRow
		const selectSQL = `SELECT id, name, path, type, storage_id FROM sys_file WHERE id = ?;`
		if err := tx.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, selectSQL), idVal).Scan(&row.id, &row.name, &row.path, &row.fileType, &row.storageID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				continue
			}
			return nil, err
		}

		if row.fileType == 0 {
			const childSQL = `SELECT 1 FROM sys_file WHERE parent_path = ? LIMIT 1;`
			var dummy int
			if err := tx.QueryRowContext(ctx, sqlutil.Rebind(r.dialect, childSQL), row.path).Scan(&dummy); err != nil && !errors.Is(err, sql.ErrNoRows) {
				return nil, err
			} else if err == nil {
				return nil, &domainstorage.DirNotEmptyError{Name: row.name}
			}
			continue
		}
		toDelete = append(toDelete, domainstorage.FileDeleteTarget{
			Path:      row.path,
			StorageID: row.storageID,
		})
	}

	deleteSQL, deleteArgs, err := sqlutil.In(r.dialect, `DELETE FROM sys_file WHERE id IN (?)`, ids)
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, deleteSQL, deleteArgs...); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return toDelete, nil
}

func derefInt64Ptr(v *int64) any {
	if v == nil {
		return nil
	}
	return *v
}

func nilIfBlank(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}
