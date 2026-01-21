package filestore

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	appstorage "voc-go-backend/internal/application/storage"
	domainstorage "voc-go-backend/internal/domain/storage"
)

// DefaultFileContentStore 是 FileContentStore 的默认实现，支持本地文件系统与 MinIO/S3 兼容对象存储。
type DefaultFileContentStore struct{}

func NewDefaultFileContentStore() *DefaultFileContentStore {
	return &DefaultFileContentStore{}
}

var _ appstorage.FileContentStore = (*DefaultFileContentStore)(nil)

func (s *DefaultFileContentStore) Save(ctx context.Context, header *multipart.FileHeader, storage *domainstorage.StorageDetail, parentPath, storedName string) (appstorage.SaveResult, error) {
	if header == nil {
		return appstorage.SaveResult{}, errors.New("nil file header")
	}
	parentPath = normalizeParentPath(parentPath)
	fullPath := joinFullPath(parentPath, storedName)

	if storage != nil && storage.Type == 2 {
		sha, size, contentType, err := putToMinIO(ctx, header, storage, fullPath)
		if err != nil {
			return appstorage.SaveResult{}, err
		}
		return appstorage.SaveResult{
			FullPath:    fullPath,
			SHA256:      sha,
			Size:        size,
			ContentType: contentType,
		}, nil
	}

	sha, size, contentType, err := saveToLocal(header, localRootDir(storage), fullPath)
	if err != nil {
		return appstorage.SaveResult{}, err
	}
	return appstorage.SaveResult{
		FullPath:    fullPath,
		SHA256:      sha,
		Size:        size,
		ContentType: contentType,
	}, nil
}

func (s *DefaultFileContentStore) Delete(ctx context.Context, storage *domainstorage.StorageDetail, fullPath string) error {
	fullPath = strings.TrimSpace(fullPath)
	if fullPath == "" {
		return nil
	}

	if storage != nil && storage.Type == 2 {
		return deleteFromMinIO(ctx, storage, fullPath)
	}
	return deleteFromLocal(localRootDir(storage), fullPath)
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

func joinFullPath(parentPath, storedName string) string {
	if parentPath == "/" {
		return "/" + storedName
	}
	return parentPath + "/" + storedName
}

func localRootDir(storage *domainstorage.StorageDetail) string {
	if storage != nil && strings.TrimSpace(storage.BucketName) != "" {
		return strings.TrimSpace(storage.BucketName)
	}
	if v := strings.TrimSpace(os.Getenv("FILE_STORAGE_DIR")); v != "" {
		return v
	}
	return "./data/file"
}

func saveToLocal(header *multipart.FileHeader, rootDir, fullPath string) (sha string, size int64, contentType string, err error) {
	relative := strings.TrimPrefix(fullPath, "/")
	dstPath := filepath.Join(rootDir, filepath.FromSlash(relative))
	if err = os.MkdirAll(filepath.Dir(dstPath), 0o755); err != nil {
		return
	}

	src, err := header.Open()
	if err != nil {
		return
	}
	defer src.Close()

	dst, err := os.Create(dstPath)
	if err != nil {
		return
	}
	defer dst.Close()

	h := sha256.New()
	w := io.MultiWriter(dst, h)
	written, err := io.Copy(w, src)
	if err != nil {
		return
	}
	size = written
	sha = hex.EncodeToString(h.Sum(nil))
	contentType = header.Header.Get("Content-Type")
	return
}

func deleteFromLocal(rootDir, fullPath string) error {
	relative := strings.TrimPrefix(fullPath, "/")
	abs := filepath.Join(rootDir, filepath.FromSlash(relative))
	return os.Remove(abs)
}

func putToMinIO(ctx context.Context, header *multipart.FileHeader, storage *domainstorage.StorageDetail, fullPath string) (sha string, size int64, contentType string, err error) {
	if storage == nil {
		return "", 0, "", errors.New("storage config is nil")
	}
	if strings.TrimSpace(storage.Endpoint) == "" || strings.TrimSpace(storage.AccessKey) == "" || strings.TrimSpace(storage.SecretKey) == "" || strings.TrimSpace(storage.BucketName) == "" {
		return "", 0, "", fmt.Errorf("对象存储配置不完整")
	}
	objectName := strings.TrimPrefix(fullPath, "/")

	contentType = header.Header.Get("Content-Type")
	src, err := header.Open()
	if err != nil {
		return "", 0, "", err
	}
	h := sha256.New()
	written, err := io.Copy(h, src)
	_ = src.Close()
	if err != nil {
		return "", 0, "", err
	}
	size = written
	sha = hex.EncodeToString(h.Sum(nil))

	client, err := newMinioClient(storage)
	if err != nil {
		return "", 0, "", err
	}

	exists, errBucket := client.BucketExists(ctx, storage.BucketName)
	if errBucket != nil {
		return "", 0, "", errBucket
	}
	if !exists {
		if err := client.MakeBucket(ctx, storage.BucketName, minio.MakeBucketOptions{Region: strings.TrimSpace(storage.Region)}); err != nil {
			return "", 0, "", err
		}
	}

	src2, err := header.Open()
	if err != nil {
		return "", 0, "", err
	}
	defer src2.Close()

	_, err = client.PutObject(ctx, storage.BucketName, objectName, src2, size, minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return "", 0, "", err
	}
	return sha, size, contentType, nil
}

func deleteFromMinIO(ctx context.Context, storage *domainstorage.StorageDetail, fullPath string) error {
	if storage == nil {
		return errors.New("storage config is nil")
	}
	client, err := newMinioClient(storage)
	if err != nil {
		return err
	}
	objectName := strings.TrimPrefix(fullPath, "/")
	return client.RemoveObject(ctx, storage.BucketName, objectName, minio.RemoveObjectOptions{})
}

func newMinioClient(storage *domainstorage.StorageDetail) (*minio.Client, error) {
	endpoint := strings.TrimSpace(storage.Endpoint)
	if endpoint == "" {
		return nil, errors.New("empty endpoint")
	}
	secure := false
	if strings.HasPrefix(endpoint, "http://") || strings.HasPrefix(endpoint, "https://") {
		u, err := url.Parse(endpoint)
		if err != nil {
			return nil, err
		}
		secure = u.Scheme == "https"
		endpoint = u.Host
	}
	return minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(strings.TrimSpace(storage.AccessKey), strings.TrimSpace(storage.SecretKey), ""),
		Secure: secure,
		Region: strings.TrimSpace(storage.Region),
	})
}

