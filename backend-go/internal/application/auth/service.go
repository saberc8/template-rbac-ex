package auth

import (
	"context"
	"errors"
	"strings"

	domain "go-backend/internal/domain/user"
)

// Service handles authentication use cases.
type Service struct {
	users       domain.Repository
	pwdVerifier PasswordVerifier
	tokenSvc    TokenGenerator
}

// NewService builds a new auth Service.
func NewService(
	users domain.Repository,
	pwdVerifier PasswordVerifier,
	tokenSvc TokenGenerator,
) *Service {
	return &Service{
		users:       users,
		pwdVerifier: pwdVerifier,
		tokenSvc:    tokenSvc,
	}
}

// Login validates credentials and issues a token.
func (s *Service) Login(ctx context.Context, req LoginRequest) (*LoginResponse, error) {
	authType := strings.ToUpper(strings.TrimSpace(req.AuthType))
	if authType != "" && authType != "ACCOUNT" {
		return nil, errors.New("暂不支持该认证方式")
	}
	if strings.TrimSpace(req.ClientID) == "" {
		return nil, errors.New("客户端ID不能为空")
	}
	if strings.TrimSpace(req.Username) == "" {
		return nil, errors.New("用户名不能为空")
	}
	if strings.TrimSpace(req.Password) == "" {
		return nil, errors.New("密码不能为空")
	}
	if s.pwdVerifier == nil || s.tokenSvc == nil {
		return nil, errors.New("认证服务未初始化")
	}
	rawPassword := req.Password

	user, err := s.users.GetByUsername(ctx, req.Username)
	if err != nil {
		return nil, err
	}
	// 用户名或密码不正确（与 Java 提示保持一致）
	if user == nil {
		return nil, errors.New("用户名或密码不正确")
	}

	ok, err := s.pwdVerifier.Verify(rawPassword, user.Password)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("用户名或密码不正确")
	}

	if !user.IsEnabled() {
		return nil, errors.New("此账号已被禁用，如有疑问，请联系管理员")
	}

	token, err := s.tokenSvc.Generate(user.ID)
	if err != nil {
		return nil, err
	}
	return &LoginResponse{
		Token:    token,
		UserID:   user.ID,
		Username: user.Username,
		Nickname: user.Nickname,
	}, nil
}
