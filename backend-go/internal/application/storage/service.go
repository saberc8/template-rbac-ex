package storage

import (
	"context"
	"strings"
	"time"

	domainstorage "voc-go-backend/internal/domain/storage"
)

// Service 提供 storage 子域的用例编排（存储配置）。
type Service struct {
	storageRepo domainstorage.StorageRepository
	nextID      func() int64
	now         func() time.Time
}

func NewService(storageRepo domainstorage.StorageRepository, nextID func() int64) *Service {
	return &Service{
		storageRepo: storageRepo,
		nextID:      nextID,
		now:         time.Now,
	}
}

func (s *Service) ListStorage(ctx context.Context, description string, typ int64) ([]domainstorage.StorageDetail, *Error) {
	list, err := s.storageRepo.List(ctx, domainstorage.StorageListFilter{
		Description: strings.TrimSpace(description),
		Type:        typ,
	})
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询存储配置失败"}
	}
	return list, nil
}

func (s *Service) GetStorage(ctx context.Context, id int64) (*domainstorage.StorageDetail, *Error) {
	if id <= 0 {
		return nil, &Error{Code: "400", Msg: "参数错误"}
	}
	item, err := s.storageRepo.Get(ctx, id)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询存储配置失败"}
	}
	if item == nil {
		return nil, &Error{Code: "404", Msg: "存储配置不存在"}
	}
	return item, nil
}

func (s *Service) CreateStorage(ctx context.Context, userID int64, req StorageCreateRequest) (int64, *Error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Code = strings.TrimSpace(req.Code)
	req.AccessKey = strings.TrimSpace(req.AccessKey)
	req.SecretKey = strings.TrimSpace(req.SecretKey)
	req.Endpoint = strings.TrimSpace(req.Endpoint)
	req.Region = strings.TrimSpace(req.Region)
	req.BucketName = strings.TrimSpace(req.BucketName)
	req.Domain = strings.TrimSpace(req.Domain)
	req.Description = strings.TrimSpace(req.Description)

	if req.Name == "" || req.Code == "" {
		return 0, &Error{Code: "400", Msg: "名称和编码不能为空"}
	}
	if req.Type == 0 {
		req.Type = 1
	}
	if req.Sort <= 0 {
		req.Sort = 999
	}
	if req.Status == 0 {
		req.Status = 1
	}
	if req.Type == 2 && req.SecretKey == "" {
		return 0, &Error{Code: "400", Msg: "私有密钥不能为空"}
	}

	exists, err := s.storageRepo.CodeExists(ctx, req.Code, nil)
	if err != nil {
		return 0, &Error{Code: "500", Msg: "校验存储编码失败"}
	}
	if exists {
		return 0, &Error{Code: "400", Msg: "新增失败，编码已存在"}
	}

	idVal := s.next()
	if idVal == 0 {
		return 0, &Error{Code: "500", Msg: "生成存储配置 ID 失败"}
	}
	now := s.now()
	isDefault := false
	if req.IsDefault != nil {
		isDefault = *req.IsDefault
	}

	item := &domainstorage.Storage{
		ID:          idVal,
		Name:        req.Name,
		Code:        req.Code,
		Type:        req.Type,
		AccessKey:   req.AccessKey,
		SecretKey:   req.SecretKey,
		Endpoint:    req.Endpoint,
		Region:      req.Region,
		BucketName:  req.BucketName,
		Domain:      req.Domain,
		Description: req.Description,
		IsDefault:   isDefault,
		Sort:        req.Sort,
		Status:      req.Status,
		CreateUser:  &userID,
		CreateTime:  now,
	}
	if err := s.storageRepo.Create(ctx, item); err != nil {
		return 0, &Error{Code: "500", Msg: "新增存储配置失败"}
	}
	return idVal, nil
}

func (s *Service) UpdateStorage(ctx context.Context, userID int64, id int64, req StorageUpdateRequest) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "参数错误"}
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Code = strings.TrimSpace(req.Code)
	req.AccessKey = strings.TrimSpace(req.AccessKey)
	req.Endpoint = strings.TrimSpace(req.Endpoint)
	req.Region = strings.TrimSpace(req.Region)
	req.BucketName = strings.TrimSpace(req.BucketName)
	req.Domain = strings.TrimSpace(req.Domain)
	req.Description = strings.TrimSpace(req.Description)
	if req.SecretKey != nil {
		v := strings.TrimSpace(*req.SecretKey)
		req.SecretKey = &v
	}

	if req.Name == "" || req.Code == "" {
		return &Error{Code: "400", Msg: "名称和编码不能为空"}
	}
	if req.Sort <= 0 {
		req.Sort = 999
	}
	if req.Status == 0 {
		req.Status = 1
	}

	exclude := id
	exists, err := s.storageRepo.CodeExists(ctx, req.Code, &exclude)
	if err != nil {
		return &Error{Code: "500", Msg: "校验存储编码失败"}
	}
	if exists {
		return &Error{Code: "400", Msg: "修改失败，编码已存在"}
	}

	old, err := s.storageRepo.Get(ctx, id)
	if err != nil {
		return &Error{Code: "500", Msg: "查询存储配置失败"}
	}
	if old == nil {
		return &Error{Code: "404", Msg: "存储配置不存在"}
	}

	secret := old.SecretKey
	if req.SecretKey != nil {
		secret = *req.SecretKey
	}
	if req.Type == 2 && strings.TrimSpace(secret) == "" {
		return &Error{Code: "400", Msg: "私有密钥不能为空"}
	}

	now := s.now()
	item := &domainstorage.Storage{
		ID:          id,
		Name:        req.Name,
		Code:        req.Code,
		Type:        req.Type,
		AccessKey:   req.AccessKey,
		SecretKey:   secret,
		Endpoint:    req.Endpoint,
		Region:      req.Region,
		BucketName:  req.BucketName,
		Domain:      req.Domain,
		Description: req.Description,
		Sort:        req.Sort,
		Status:      req.Status,
		UpdateUser:  &userID,
		UpdateTime:  &now,
	}
	if req.IsDefault != nil {
		item.IsDefault = *req.IsDefault
	}
	if err := s.storageRepo.Update(ctx, item); err != nil {
		return &Error{Code: "500", Msg: "修改存储配置失败"}
	}
	return nil
}

func (s *Service) DeleteStorage(ctx context.Context, ids []int64) *Error {
	if len(ids) == 0 {
		return &Error{Code: "400", Msg: "参数错误"}
	}
	if err := s.storageRepo.Delete(ctx, ids); err != nil {
		if err == domainstorage.ErrDefaultStorage {
			return &Error{Code: "400", Msg: "不允许删除默认存储"}
		}
		return &Error{Code: "500", Msg: "删除存储配置失败"}
	}
	return nil
}

func (s *Service) UpdateStorageStatus(ctx context.Context, userID int64, id int64, status int16) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "参数错误"}
	}
	if status != 1 && status != 2 {
		return &Error{Code: "400", Msg: "状态参数不正确"}
	}
	item, err := s.storageRepo.Get(ctx, id)
	if err != nil {
		return &Error{Code: "500", Msg: "更新存储状态失败"}
	}
	if item == nil {
		return &Error{Code: "404", Msg: "存储配置不存在"}
	}
	if item.IsDefault && status != 1 {
		return &Error{Code: "400", Msg: "不允许禁用默认存储"}
	}
	if err := s.storageRepo.UpdateStatus(ctx, id, status, userID); err != nil {
		return &Error{Code: "500", Msg: "修改存储状态失败"}
	}
	return nil
}

func (s *Service) SetDefaultStorage(ctx context.Context, userID int64, id int64) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "参数错误"}
	}
	item, err := s.storageRepo.Get(ctx, id)
	if err != nil {
		return &Error{Code: "500", Msg: "设置默认存储失败"}
	}
	if item == nil {
		return &Error{Code: "404", Msg: "存储配置不存在"}
	}
	if err := s.storageRepo.SetDefault(ctx, id, userID); err != nil {
		return &Error{Code: "500", Msg: "设置默认存储失败"}
	}
	return nil
}

func (s *Service) next() int64 {
	if s == nil || s.nextID == nil {
		return 0
	}
	return s.nextID()
}
