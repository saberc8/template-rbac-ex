package storage

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	domainstorage "voc-go-backend/internal/domain/storage"
)

// FileService 提供文件管理的用例编排（sys_file）。
type FileService struct {
	storageRepo domainstorage.StorageRepository
	fileRepo    domainstorage.FileRepository
	store       FileContentStore
	nextID      func() int64
	now         func() time.Time
}

func NewFileService(
	storageRepo domainstorage.StorageRepository,
	fileRepo domainstorage.FileRepository,
	store FileContentStore,
	nextID func() int64,
) *FileService {
	return &FileService{
		storageRepo: storageRepo,
		fileRepo:    fileRepo,
		store:       store,
		nextID:      nextID,
		now:         time.Now,
	}
}

func (s *FileService) NewID() (int64, *Error) {
	if s == nil || s.nextID == nil {
		return 0, &Error{Code: "500", Msg: "生成文件 ID 失败"}
	}
	idVal := s.nextID()
	if idVal <= 0 {
		return 0, &Error{Code: "500", Msg: "生成文件 ID 失败"}
	}
	return idVal, nil
}

func (s *FileService) GetDefaultStorage(ctx context.Context) (*domainstorage.StorageDetail, *Error) {
	item, err := s.storageRepo.GetDefault(ctx)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "获取存储配置失败"}
	}
	return item, nil
}

func (s *FileService) GetStoragesByIDs(ctx context.Context, ids []int64) (map[int64]domainstorage.StorageDetail, *Error) {
	list, err := s.storageRepo.ListByIDs(ctx, ids)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "获取存储配置失败"}
	}
	out := make(map[int64]domainstorage.StorageDetail, len(list))
	for _, it := range list {
		out[it.ID] = it
	}
	return out, nil
}

func (s *FileService) Page(ctx context.Context, q domainstorage.FilePageQuery) ([]domainstorage.FileDetail, int64, *Error) {
	q.OriginalName = strings.TrimSpace(q.OriginalName)
	q.ParentPath = strings.TrimSpace(q.ParentPath)

	list, total, err := s.fileRepo.Page(ctx, q)
	if err != nil {
		return nil, 0, &Error{Code: "500", Msg: "查询文件失败"}
	}
	return list, total, nil
}

func (s *FileService) GetByHash(ctx context.Context, sha256 string) (*domainstorage.FileDetail, *Error) {
	sha256 = strings.TrimSpace(sha256)
	if sha256 == "" {
		return nil, nil
	}
	item, err := s.fileRepo.GetByHash(ctx, sha256)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询文件失败"}
	}
	return item, nil
}

func (s *FileService) CreateDir(ctx context.Context, userID int64, parentPath, name string) *Error {
	name = strings.TrimSpace(name)
	parentPath = strings.TrimSpace(parentPath)
	if name == "" {
		return &Error{Code: "400", Msg: "名称不能为空"}
	}
	if parentPath == "" {
		parentPath = "/"
	}

	exists, err := s.fileRepo.DirExists(ctx, parentPath, name)
	if err != nil {
		return &Error{Code: "500", Msg: "校验文件夹失败"}
	}
	if exists {
		return &Error{Code: "400", Msg: "文件夹已存在"}
	}

	storageCfg, err := s.storageRepo.GetDefault(ctx)
	if err != nil || storageCfg == nil {
		return &Error{Code: "500", Msg: "获取存储配置失败"}
	}

	idVal, derr := s.NewID()
	if derr != nil {
		return derr
	}
	path := parentPath
	if parentPath == "/" {
		path = "/" + name
	} else {
		path = parentPath + "/" + name
	}
	now := s.now()
	dir := &domainstorage.File{
		ID:           idVal,
		Name:         name,
		OriginalName: name,
		ParentPath:   parentPath,
		Path:         path,
		Type:         0,
		StorageID:    storageCfg.ID,
		CreateUser:   &userID,
		CreateTime:   now,
	}
	if err := s.fileRepo.CreateDir(ctx, dir); err != nil {
		return &Error{Code: "500", Msg: "创建文件夹失败"}
	}
	return nil
}

func (s *FileService) CreateUploadedFileRecord(ctx context.Context, userID int64, f *domainstorage.File) *Error {
	if f == nil {
		return &Error{Code: "400", Msg: "请求参数不正确"}
	}
	if f.ID <= 0 {
		return &Error{Code: "500", Msg: "生成文件 ID 失败"}
	}
	if f.StorageID <= 0 {
		return &Error{Code: "500", Msg: "获取存储配置失败"}
	}
	if strings.TrimSpace(f.ParentPath) == "" {
		f.ParentPath = "/"
	}
	f.Name = strings.TrimSpace(f.Name)
	f.OriginalName = strings.TrimSpace(f.OriginalName)
	f.Path = strings.TrimSpace(f.Path)
	f.Extension = strings.TrimSpace(f.Extension)
	f.ContentType = strings.TrimSpace(f.ContentType)
	f.Sha256 = strings.TrimSpace(f.Sha256)

	if f.Name == "" || f.OriginalName == "" || f.Path == "" {
		return &Error{Code: "400", Msg: "请求参数不正确"}
	}
	if f.Type == 0 {
		return &Error{Code: "400", Msg: "请求参数不正确"}
	}

	now := s.now()
	f.CreateUser = &userID
	f.CreateTime = now
	if err := s.fileRepo.CreateFile(ctx, f); err != nil {
		return &Error{Code: "500", Msg: "保存文件记录失败"}
	}
	return nil
}

type UploadResult struct {
	ID           int64
	StoredName   string
	OriginalName string
	FullPath     string
	Extension    string
	ContentType  string
	SHA256       string
	Size         int64
	FileType     int16
	Storage      *domainstorage.StorageDetail
}

func (s *FileService) Upload(ctx context.Context, userID int64, header *multipart.FileHeader, parentPath string) (*UploadResult, *Error) {
	if header == nil {
		return nil, &Error{Code: "400", Msg: "文件不能为空"}
	}
	if s == nil || s.store == nil {
		return nil, &Error{Code: "500", Msg: "保存文件失败"}
	}
	parentPath = strings.TrimSpace(parentPath)
	if parentPath == "" {
		parentPath = "/"
	}

	ext := extensionFromFilename(header.Filename)
	fileID, derr := s.NewID()
	if derr != nil {
		return nil, derr
	}
	storedName := buildStoredName(fileID, ext)

	storageCfg, derr := s.GetDefaultStorage(ctx)
	if derr != nil {
		return nil, derr
	}

	save, err := s.store.Save(ctx, header, storageCfg, parentPath, storedName)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "保存文件失败"}
	}

	fileType := detectFileType(ext, save.ContentType)
	sizeVal := save.Size
	if derr := s.CreateUploadedFileRecord(ctx, userID, &domainstorage.File{
		ID:           fileID,
		Name:         storedName,
		OriginalName: header.Filename,
		Size:         &sizeVal,
		ParentPath:   normalizeParentPath(parentPath),
		Path:         save.FullPath,
		Extension:    ext,
		ContentType:  save.ContentType,
		Type:         fileType,
		Sha256:       save.SHA256,
		Metadata:     "",
		StorageID:    storageCfg.ID,
	}); derr != nil {
		return nil, derr
	}

	return &UploadResult{
		ID:           fileID,
		StoredName:   storedName,
		OriginalName: header.Filename,
		FullPath:     save.FullPath,
		Extension:    ext,
		ContentType:  save.ContentType,
		SHA256:       save.SHA256,
		Size:         save.Size,
		FileType:     fileType,
		Storage:      storageCfg,
	}, nil
}

func (s *FileService) UpdateOriginalName(ctx context.Context, userID int64, id int64, originalName string) *Error {
	originalName = strings.TrimSpace(originalName)
	if id <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	if originalName == "" {
		return &Error{Code: "400", Msg: "名称不能为空"}
	}
	if err := s.fileRepo.UpdateOriginalName(ctx, id, originalName, userID); err != nil {
		return &Error{Code: "500", Msg: "重命名失败"}
	}
	return nil
}

func (s *FileService) CalcDirSize(ctx context.Context, id int64) (int64, *Error) {
	if id <= 0 {
		return 0, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	item, err := s.fileRepo.Get(ctx, id)
	if err != nil {
		return 0, &Error{Code: "500", Msg: "查询文件夹失败"}
	}
	if item == nil {
		return 0, &Error{Code: "404", Msg: "文件夹不存在"}
	}
	if item.Type != 0 {
		return 0, &Error{Code: "400", Msg: "ID 不是文件夹，无法计算大小"}
	}
	prefix := strings.TrimRight(item.Path, "/") + "/%"
	total, err := s.fileRepo.SumSizeByPathPrefix(ctx, prefix)
	if err != nil {
		return 0, &Error{Code: "500", Msg: "计算文件夹大小失败"}
	}
	return total, nil
}

func (s *FileService) Statistics(ctx context.Context) ([]domainstorage.FileStatItem, *Error) {
	list, err := s.fileRepo.Statistics(ctx)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询文件统计失败"}
	}
	return list, nil
}

func (s *FileService) Delete(ctx context.Context, ids []int64) ([]domainstorage.FileDeleteTarget, *Error) {
	if len(ids) == 0 {
		return nil, &Error{Code: "400", Msg: "ID 列表不能为空"}
	}
	toDelete, err := s.fileRepo.DeleteWithChecks(ctx, ids)
	if err != nil {
		var dirErr *domainstorage.DirNotEmptyError
		if errors.As(err, &dirErr) {
			return nil, &Error{Code: "400", Msg: "文件夹 [" + dirErr.Name + "] 不为空，请先删除文件夹下的内容"}
		}
		return nil, &Error{Code: "500", Msg: "删除文件失败"}
	}
	return toDelete, nil
}

// DeleteWithPhysical 先删除 DB 记录，再对物理文件做 best-effort 删除（失败不影响接口成功）。
func (s *FileService) DeleteWithPhysical(ctx context.Context, ids []int64) *Error {
	targets, derr := s.Delete(ctx, ids)
	if derr != nil {
		return derr
	}
	if len(targets) == 0 || s == nil || s.store == nil {
		return nil
	}

	uniqueStorageIDs := make(map[int64]struct{}, len(targets))
	for _, t := range targets {
		if t.StorageID > 0 {
			uniqueStorageIDs[t.StorageID] = struct{}{}
		}
	}
	storageIDs := make([]int64, 0, len(uniqueStorageIDs))
	for idVal := range uniqueStorageIDs {
		storageIDs = append(storageIDs, idVal)
	}
	storages, derr := s.GetStoragesByIDs(ctx, storageIDs)
	if derr != nil {
		return derr
	}

	for _, t := range targets {
		cfg, ok := storages[t.StorageID]
		if !ok {
			continue
		}
		cpy := cfg
		_ = s.store.Delete(ctx, &cpy, t.Path)
	}
	return nil
}

func normalizeParentPath(p string) string {
	p = strings.TrimSpace(p)
	if p == "" {
		return "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	if len(p) > 1 {
		p = strings.TrimRight(p, "/")
	}
	return p
}

func extensionFromFilename(name string) string {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(name)), ".")
	return ext
}

func detectFileType(ext, contentType string) int16 {
	ext = strings.ToLower(ext)
	switch {
	case strings.HasPrefix(contentType, "image/"):
		return 2
	case strings.HasPrefix(contentType, "video/"):
		return 4
	case strings.HasPrefix(contentType, "audio/"):
		return 5
	case ext == "jpg" || ext == "jpeg" || ext == "png" || ext == "gif":
		return 2
	case ext == "doc" || ext == "docx" || ext == "xls" || ext == "xlsx" || ext == "ppt" || ext == "pptx" || ext == "pdf" || ext == "txt":
		return 3
	default:
		return 1
	}
}

func buildStoredName(fileID int64, ext string) string {
	if strings.TrimSpace(ext) != "" {
		return fmt.Sprintf("%d.%s", fileID, ext)
	}
	return fmt.Sprintf("%d", fileID)
}
