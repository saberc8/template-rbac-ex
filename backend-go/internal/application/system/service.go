package system

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	domainsys "go-backend/internal/domain/system"
)

// Service 提供 system 子域的用例编排（部门/系统配置）。
type Service struct {
	deptRepo   domainsys.DeptRepository
	optionRepo domainsys.OptionRepository
	nextID     func() int64
	now        func() time.Time
}

func NewService(
	deptRepo domainsys.DeptRepository,
	optionRepo domainsys.OptionRepository,
	nextID func() int64,
) *Service {
	return &Service{
		deptRepo:   deptRepo,
		optionRepo: optionRepo,
		nextID:     nextID,
		now:        time.Now,
	}
}

func (s *Service) ListDept(ctx context.Context, description string, status int64) ([]domainsys.DeptDetail, *Error) {
	list, err := s.deptRepo.List(ctx, domainsys.DeptListFilter{
		Description: strings.TrimSpace(description),
		Status:      status,
	})
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询部门失败"}
	}
	return list, nil
}

func (s *Service) GetDept(ctx context.Context, id int64) (*domainsys.DeptDetail, *Error) {
	if id <= 0 {
		return nil, &Error{Code: "400", Msg: "无效的部门 ID"}
	}
	d, err := s.deptRepo.Get(ctx, id)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询部门失败"}
	}
	if d == nil {
		return nil, &Error{Code: "404", Msg: "部门不存在"}
	}
	return d, nil
}

func (s *Service) CreateDept(ctx context.Context, userID int64, req DeptCreateRequest) *Error {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	if req.Name == "" {
		return &Error{Code: "400", Msg: "名称不能为空"}
	}
	if req.ParentID == 0 {
		return &Error{Code: "400", Msg: "上级部门不能为空"}
	}
	if req.Sort <= 0 {
		req.Sort = 1
	}
	if req.Status == 0 {
		req.Status = 1
	}

	exists, err := s.deptRepo.NameExistsUnderParent(ctx, req.ParentID, req.Name, nil)
	if err != nil {
		return &Error{Code: "500", Msg: "校验部门名称失败"}
	}
	if exists {
		return &Error{Code: "400", Msg: "新增失败，该名称在当前上级下已存在"}
	}

	parentOK, err := s.deptRepo.Exists(ctx, req.ParentID)
	if err != nil {
		return &Error{Code: "500", Msg: "校验上级部门失败"}
	}
	if !parentOK {
		return &Error{Code: "400", Msg: "上级部门不存在"}
	}

	now := s.now()
	newID := s.next()
	if newID == 0 {
		return &Error{Code: "500", Msg: "生成部门 ID 失败"}
	}

	d := &domainsys.Dept{
		ID:          newID,
		Name:        req.Name,
		ParentID:    req.ParentID,
		Sort:        req.Sort,
		Status:      req.Status,
		IsSystem:    false,
		Description: req.Description,
		CreateUser:  &userID,
		CreateTime:  now,
	}
	if err := s.deptRepo.Create(ctx, d); err != nil {
		return &Error{Code: "500", Msg: "新增部门失败"}
	}
	return nil
}

func (s *Service) UpdateDept(ctx context.Context, userID int64, id int64, req DeptUpdateRequest) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "无效的部门 ID"}
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	if req.Name == "" {
		return &Error{Code: "400", Msg: "名称不能为空"}
	}
	if req.ParentID == 0 {
		return &Error{Code: "400", Msg: "上级部门不能为空"}
	}
	if req.Sort <= 0 {
		req.Sort = 1
	}
	if req.Status == 0 {
		req.Status = 1
	}

	oldName, oldParentID, isSystem, err := s.deptRepo.GetMeta(ctx, id)
	if err != nil {
		return &Error{Code: "500", Msg: "查询部门失败"}
	}
	if oldName == "" {
		return &Error{Code: "404", Msg: "部门不存在"}
	}

	if isSystem {
		if req.Status == 2 {
			return &Error{Code: "400", Msg: "[" + oldName + "] 是系统内置部门，不允许禁用"}
		}
		if req.ParentID != oldParentID {
			return &Error{Code: "400", Msg: "[" + oldName + "] 是系统内置部门，不允许变更上级部门"}
		}
	}

	exclude := id
	exists, err := s.deptRepo.NameExistsUnderParent(ctx, req.ParentID, req.Name, &exclude)
	if err != nil {
		return &Error{Code: "500", Msg: "校验部门名称失败"}
	}
	if exists {
		return &Error{Code: "400", Msg: "修改失败，该名称在当前上级下已存在"}
	}

	parentOK, err := s.deptRepo.Exists(ctx, req.ParentID)
	if err != nil {
		return &Error{Code: "500", Msg: "校验上级部门失败"}
	}
	if !parentOK {
		return &Error{Code: "400", Msg: "上级部门不存在"}
	}

	now := s.now()
	d := &domainsys.Dept{
		ID:          id,
		Name:        req.Name,
		ParentID:    req.ParentID,
		Sort:        req.Sort,
		Status:      req.Status,
		Description: req.Description,
		UpdateUser:  &userID,
		UpdateTime:  &now,
	}
	if err := s.deptRepo.Update(ctx, d); err != nil {
		return &Error{Code: "500", Msg: "修改部门失败"}
	}
	return nil
}

func (s *Service) DeleteDept(ctx context.Context, ids []int64) *Error {
	if len(ids) == 0 {
		return &Error{Code: "400", Msg: "参数错误"}
	}

	sysName, found, err := s.deptRepo.FindSystemDeptName(ctx, ids)
	if err != nil {
		return &Error{Code: "500", Msg: "校验系统内置部门失败"}
	}
	if found {
		return &Error{Code: "400", Msg: "所选部门 [" + sysName + "] 是系统内置部门，不允许删除"}
	}

	hasChild, err := s.deptRepo.HasChildren(ctx, ids)
	if err != nil {
		return &Error{Code: "500", Msg: "校验子部门失败"}
	}
	if hasChild {
		return &Error{Code: "400", Msg: "所选部门存在下级部门，不允许删除"}
	}

	hasUsers, err := s.deptRepo.HasUsers(ctx, ids)
	if err != nil {
		return &Error{Code: "500", Msg: "校验用户关联失败"}
	}
	if hasUsers {
		return &Error{Code: "400", Msg: "所选部门存在用户关联，请解除关联后重试"}
	}

	if err := s.deptRepo.Delete(ctx, ids); err != nil {
		return &Error{Code: "500", Msg: "删除部门失败"}
	}
	return nil
}

func (s *Service) ListOption(ctx context.Context, codes []string, category string) ([]domainsys.OptionView, *Error) {
	out, err := s.optionRepo.List(ctx, domainsys.OptionListFilter{
		Codes:    codes,
		Category: strings.TrimSpace(category),
	})
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询系统配置失败"}
	}
	return out, nil
}

func (s *Service) UpdateOption(ctx context.Context, userID int64, body []OptionUpdateRequest) *Error {
	if len(body) == 0 {
		return &Error{Code: "400", Msg: "请求参数不正确"}
	}

	updates := make([]domainsys.OptionUpdate, 0, len(body))
	for _, o := range body {
		if o.ID <= 0 || strings.TrimSpace(o.Code) == "" {
			return &Error{Code: "400", Msg: "请求参数不正确"}
		}
		updates = append(updates, domainsys.OptionUpdate{
			ID:    o.ID,
			Code:  strings.TrimSpace(o.Code),
			Value: toOptionValueString(o.Value),
		})
	}

	if err := s.optionRepo.UpdateValues(ctx, userID, updates); err != nil {
		return &Error{Code: "500", Msg: "保存系统配置失败"}
	}
	return nil
}

func (s *Service) ResetOptionValue(ctx context.Context, req OptionResetRequest) *Error {
	req.Category = strings.TrimSpace(req.Category)
	for i := range req.Codes {
		req.Codes[i] = strings.TrimSpace(req.Codes[i])
	}
	if len(req.Codes) == 0 && req.Category == "" {
		return &Error{Code: "400", Msg: "键列表或类别不能为空"}
	}
	if err := s.optionRepo.ResetValues(ctx, domainsys.OptionResetFilter{
		Codes:    req.Codes,
		Category: req.Category,
	}); err != nil {
		return &Error{Code: "500", Msg: "恢复默认配置失败"}
	}
	return nil
}

func (s *Service) IsOptionEnabled(ctx context.Context, code string) (bool, *Error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return false, &Error{Code: "400", Msg: "配置编码不能为空"}
	}
	val, found, err := s.optionRepo.GetMergedValue(ctx, code)
	if err != nil {
		return false, &Error{Code: "500", Msg: "查询配置失败"}
	}
	if !found {
		return false, nil
	}
	val = strings.TrimSpace(val)
	return val != "" && val != "0", nil
}

// toOptionValueString 将任意 JSON 解析后的值转换为字符串，便于存入 sys_option.value。
func toOptionValueString(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatInt(int64(t), 10)
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		b, err := json.Marshal(t)
		if err != nil {
			return ""
		}
		return string(b)
	}
}

func (s *Service) next() int64 {
	if s == nil || s.nextID == nil {
		return 0
	}
	return s.nextID()
}
