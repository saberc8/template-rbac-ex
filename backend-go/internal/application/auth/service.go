package auth

import (
	"context"
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
func (s *Service) Login(ctx context.Context, req LoginRequest) (*LoginResponse, *Error) {
	authType := strings.ToUpper(strings.TrimSpace(req.AuthType))
	if authType != "" && authType != "ACCOUNT" {
		return nil, &Error{Code: "400", Msg: "暂不支持该认证方式"}
	}
	if strings.TrimSpace(req.ClientID) == "" {
		return nil, &Error{Code: "400", Msg: "客户端ID不能为空"}
	}
	if strings.TrimSpace(req.Username) == "" {
		return nil, &Error{Code: "400", Msg: "用户名不能为空"}
	}
	if strings.TrimSpace(req.Password) == "" {
		return nil, &Error{Code: "400", Msg: "密码不能为空"}
	}
	if s.pwdVerifier == nil || s.tokenSvc == nil {
		return nil, &Error{Code: "500", Msg: "认证服务未初始化"}
	}
	rawPassword := req.Password

	user, err := s.users.GetByUsername(ctx, req.Username)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "查询用户失败"}
	}
	// 用户名或密码不正确（与 Java 提示保持一致）
	if user == nil {
		return nil, &Error{Code: "400", Msg: "用户名或密码不正确"}
	}

	ok, err := s.pwdVerifier.Verify(rawPassword, user.Password)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "校验密码失败"}
	}
	if !ok {
		return nil, &Error{Code: "400", Msg: "用户名或密码不正确"}
	}

	if !user.IsEnabled() {
		return nil, &Error{Code: "400", Msg: "此账号已被禁用，如有疑问，请联系管理员"}
	}

	token, err := s.tokenSvc.Generate(user.ID)
	if err != nil {
		return nil, &Error{Code: "500", Msg: "生成令牌失败"}
	}
	return &LoginResponse{
		Token:    token,
		UserID:   user.ID,
		Username: user.Username,
		Nickname: user.Nickname,
	}, nil
}
