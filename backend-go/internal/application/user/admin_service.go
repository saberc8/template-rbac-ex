package user

import (
	"context"
	"database/sql"
	"strings"
	"time"

	domainrbac "voc-go-backend/internal/domain/rbac"
	domainuser "voc-go-backend/internal/domain/user"
)

// AdminService 提供用户管理的用例编排（sys_user + sys_user_role）。
type AdminService struct {
	repo     domainuser.AdminRepository
	roleRepo domainrbac.RoleAdminRepository
	nextID   func() int64
	now      func() time.Time
	hasher   PasswordHasher
}

func NewAdminService(
	repo domainuser.AdminRepository,
	roleRepo domainrbac.RoleAdminRepository,
	nextID func() int64,
	hasher PasswordHasher,
) *AdminService {
	return &AdminService{
		repo:     repo,
		roleRepo: roleRepo,
		nextID:   nextID,
		now:      time.Now,
		hasher:   hasher,
	}
}

type UserPageQuery struct {
	Page        int
	Size        int
	Description string
	Status      *int64
	DeptID      *int64
}

type UserDetail struct {
	domainuser.AdminUserDetailWithPwdReset
	RoleIDs   []int64
	RoleNames []string
}

type UserSave struct {
	Username    string
	Nickname    string
	Password    string // create only (base64 encrypted)
	Gender      int16
	Email       string
	Phone       string
	Avatar      string
	Description string
	Status      int16
	DeptID      int64
	RoleIDs     []int64
}

type UserDictItem struct {
	ID       int64
	Nickname string
	Username string
}

func (s *AdminService) Page(ctx context.Context, q UserPageQuery) ([]UserDetail, int64, *Error) {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Size <= 0 {
		q.Size = 10
	}

	list, total, err := s.repo.Page(ctx, domainuser.AdminUserPageQuery{
		Page:        q.Page,
		Size:        q.Size,
		Description: strings.TrimSpace(q.Description),
		Status:      q.Status,
		DeptID:      q.DeptID,
	})
	if err != nil {
		return nil, 0, &Error{Code: "500", Msg: "查询用户失败"}
	}
	if total == 0 || len(list) == 0 {
		return []UserDetail{}, 0, nil
	}

	return s.withRoles(ctx, list, total)
}

func (s *AdminService) List(ctx context.Context, ids []int64) ([]UserDetail, *Error) {
	list, err := s.repo.List(ctx, ids)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询用户失败"}
	}
	if len(list) == 0 {
		return []UserDetail{}, nil
	}
	out, _, derr := s.withRoles(ctx, list, int64(len(list)))
	if derr != nil {
		return nil, derr
	}
	return out, nil
}

func (s *AdminService) GetDetail(ctx context.Context, id int64) (*UserDetail, *Error) {
	if id <= 0 {
		return nil, &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	row, err := s.repo.GetDetail(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, &Error{Code: "404", Msg: "用户不存在"}
		}
		return nil, &Error{Code: "500", Msg: "查询用户失败"}
	}
	if row == nil {
		return nil, &Error{Code: "404", Msg: "用户不存在"}
	}

	out, _, derr := s.withRoles(ctx, []domainuser.AdminUserDetail{row.AdminUserDetail}, 1)
	if derr != nil {
		return nil, derr
	}
	if len(out) == 0 {
		return nil, &Error{Code: "404", Msg: "用户不存在"}
	}
	d := out[0]
	d.PwdResetTime = row.PwdResetTime
	return &d, nil
}

func (s *AdminService) Create(ctx context.Context, userID int64, req UserSave) (int64, *Error) {
	req.Username = strings.TrimSpace(req.Username)
	req.Nickname = strings.TrimSpace(req.Nickname)
	if req.Username == "" || req.Nickname == "" {
		return 0, &Error{Code: "400", Msg: "用户名和昵称不能为空"}
	}
	if req.DeptID == 0 {
		return 0, &Error{Code: "400", Msg: "所属部门不能为空"}
	}
	if req.Status == 0 {
		req.Status = 1
	}
	if strings.TrimSpace(req.Password) == "" {
		return 0, &Error{Code: "400", Msg: "密码不能为空"}
	}

	rawPwd, derr := s.validatePassword(req.Password)
	if derr != nil {
		return 0, derr
	}

	encodedPwd, err := s.hasher.Hash(rawPwd)
	if err != nil {
		return 0, &Error{Code: "500", Msg: "密码加密失败"}
	}

	now := s.now()
	idVal := s.next()
	if idVal <= 0 {
		return 0, &Error{Code: "500", Msg: "新增用户失败"}
	}

	u := &domainuser.User{
		ID:           idVal,
		Username:     req.Username,
		Nickname:     req.Nickname,
		Password:     encodedPwd,
		Gender:       req.Gender,
		Status:       req.Status,
		IsSystem:     false,
		DeptID:       req.DeptID,
		CreateUser:   &userID,
		CreateTime:   now,
		PwdResetTime: &now,
	}
	if strings.TrimSpace(req.Email) != "" {
		v := strings.TrimSpace(req.Email)
		u.Email = &v
	}
	if strings.TrimSpace(req.Phone) != "" {
		v := strings.TrimSpace(req.Phone)
		u.Phone = &v
	}
	if strings.TrimSpace(req.Avatar) != "" {
		v := strings.TrimSpace(req.Avatar)
		u.Avatar = &v
	}
	if strings.TrimSpace(req.Description) != "" {
		v := strings.TrimSpace(req.Description)
		u.Description = &v
	}

	userRoleIDs, derr := s.mustNextIDs(len(req.RoleIDs))
	if derr != nil {
		return 0, derr
	}
	if err := s.repo.Create(ctx, u, req.RoleIDs, userRoleIDs); err != nil {
		return 0, &Error{Code: "500", Msg: "新增用户失败"}
	}
	return idVal, nil
}

func (s *AdminService) Update(ctx context.Context, userID int64, id int64, req UserSave) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Nickname = strings.TrimSpace(req.Nickname)
	if req.Username == "" || req.Nickname == "" {
		return &Error{Code: "400", Msg: "用户名和昵称不能为空"}
	}
	if req.DeptID == 0 {
		return &Error{Code: "400", Msg: "所属部门不能为空"}
	}
	if req.Status == 0 {
		req.Status = 1
	}

	now := s.now()
	u := &domainuser.User{
		ID:         id,
		Username:   req.Username,
		Nickname:   req.Nickname,
		Gender:     req.Gender,
		Status:     req.Status,
		DeptID:     req.DeptID,
		UpdateUser: &userID,
		UpdateTime: &now,
	}
	if strings.TrimSpace(req.Email) != "" {
		v := strings.TrimSpace(req.Email)
		u.Email = &v
	}
	if strings.TrimSpace(req.Phone) != "" {
		v := strings.TrimSpace(req.Phone)
		u.Phone = &v
	}
	if strings.TrimSpace(req.Avatar) != "" {
		v := strings.TrimSpace(req.Avatar)
		u.Avatar = &v
	}
	if strings.TrimSpace(req.Description) != "" {
		v := strings.TrimSpace(req.Description)
		u.Description = &v
	}

	userRoleIDs, derr := s.mustNextIDs(len(req.RoleIDs))
	if derr != nil {
		return derr
	}
	if err := s.repo.Update(ctx, u, req.RoleIDs, userRoleIDs); err != nil {
		return &Error{Code: "500", Msg: "修改用户失败"}
	}
	return nil
}

func (s *AdminService) Delete(ctx context.Context, ids []int64) *Error {
	if len(ids) == 0 {
		return &Error{Code: "400", Msg: "ID 列表不能为空"}
	}
	if err := s.repo.Delete(ctx, ids); err != nil {
		return &Error{Code: "500", Msg: "删除用户失败"}
	}
	return nil
}

func (s *AdminService) ResetPassword(ctx context.Context, userID int64, id int64, encrypted string) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	if strings.TrimSpace(encrypted) == "" {
		return &Error{Code: "400", Msg: "密码不能为空"}
	}
	rawPwd, derr := s.validatePassword(encrypted)
	if derr != nil {
		return derr
	}
	encodedPwd, err := s.hasher.Hash(rawPwd)
	if err != nil {
		return &Error{Code: "500", Msg: "密码加密失败"}
	}
	now := s.now()
	if err := s.repo.UpdatePassword(ctx, id, encodedPwd, now, userID, now); err != nil {
		return &Error{Code: "500", Msg: "重置密码失败"}
	}
	return nil
}

func (s *AdminService) UpdateUserRole(ctx context.Context, id int64, roleIDs []int64) *Error {
	if id <= 0 {
		return &Error{Code: "400", Msg: "ID 参数不正确"}
	}
	userRoleIDs, derr := s.mustNextIDs(len(roleIDs))
	if derr != nil {
		return derr
	}
	if err := s.repo.ReplaceRoles(ctx, id, roleIDs, userRoleIDs); err != nil {
		return &Error{Code: "500", Msg: "分配角色失败"}
	}
	return nil
}

func (s *AdminService) ExportRows(ctx context.Context) ([]domainuser.AdminUserExportRow, *Error) {
	list, err := s.repo.ExportRows(ctx)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "导出用户失败"}
	}
	return list, nil
}

func (s *AdminService) ListUserDict(ctx context.Context, status *int64) ([]UserDictItem, *Error) {
	q := domainuser.AdminUserPageQuery{Page: 1, Size: 100000}
	if status != nil {
		q.Status = status
	} else {
		v := int64(1)
		q.Status = &v
	}
	list, _, err := s.repo.Page(ctx, q)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询用户失败"}
	}
	out := make([]UserDictItem, 0, len(list))
	for _, u := range list {
		out = append(out, UserDictItem{
			ID:       u.ID,
			Nickname: firstNonBlank(u.Nickname, u.Username),
			Username: u.Username,
		})
	}
	return out, nil
}

func (s *AdminService) withRoles(ctx context.Context, users []domainuser.AdminUserDetail, total int64) ([]UserDetail, int64, *Error) {
	userIDs := make([]int64, 0, len(users))
	seen := make(map[int64]struct{})
	for _, u := range users {
		if u.ID <= 0 {
			continue
		}
		if _, ok := seen[u.ID]; ok {
			continue
		}
		seen[u.ID] = struct{}{}
		userIDs = append(userIDs, u.ID)
	}

	roleMap := map[int64][]domainrbac.RoleBrief{}
	if len(userIDs) > 0 && s.roleRepo != nil {
		m, err := s.roleRepo.ListUserRoles(ctx, userIDs)
		if err != nil {
			return nil, 0, &Error{Code: "500", Msg: "查询用户角色失败"}
		}
		roleMap = m
	}

	out := make([]UserDetail, 0, len(users))
	for _, row := range users {
		item := UserDetail{AdminUserDetailWithPwdReset: domainuser.AdminUserDetailWithPwdReset{AdminUserDetail: row}}
		if roles := roleMap[row.ID]; len(roles) > 0 {
			item.RoleIDs = make([]int64, 0, len(roles))
			item.RoleNames = make([]string, 0, len(roles))
			for _, r := range roles {
				item.RoleIDs = append(item.RoleIDs, r.RoleID)
				item.RoleNames = append(item.RoleNames, r.RoleName)
			}
		}
		out = append(out, item)
	}
	return out, total, nil
}

func (s *AdminService) validatePassword(rawPwd string) (string, *Error) {
	rawPwd = strings.TrimSpace(rawPwd)
	if rawPwd == "" {
		return "", &Error{Code: "400", Msg: "密码不能为空"}
	}
	if len(rawPwd) < 8 || len(rawPwd) > 32 {
		return "", &Error{Code: "400", Msg: "密码长度为 8-32 个字符，至少包含字母和数字"}
	}
	var hasLetter, hasDigit bool
	for _, ch := range rawPwd {
		switch {
		case ch >= '0' && ch <= '9':
			hasDigit = true
		case (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'):
			hasLetter = true
		}
	}
	if !hasLetter || !hasDigit {
		return "", &Error{Code: "400", Msg: "密码长度为 8-32 个字符，至少包含字母和数字"}
	}
	return rawPwd, nil
}

func (s *AdminService) next() int64 {
	if s == nil || s.nextID == nil {
		return 0
	}
	return s.nextID()
}

func (s *AdminService) nextIDs(n int) []int64 {
	if n <= 0 {
		return nil
	}
	out := make([]int64, 0, n)
	for i := 0; i < n; i++ {
		idVal := s.next()
		out = append(out, idVal)
	}
	return out
}

func (s *AdminService) mustNextIDs(n int) ([]int64, *Error) {
	ids := s.nextIDs(n)
	for _, v := range ids {
		if v <= 0 {
			return nil, &Error{Code: "500", Msg: "生成用户角色 ID 失败"}
		}
	}
	return ids, nil
}

func firstNonBlank(a, b string) string {
	a = strings.TrimSpace(a)
	if a != "" {
		return a
	}
	return strings.TrimSpace(b)
}
