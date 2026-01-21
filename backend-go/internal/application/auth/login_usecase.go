package auth

import (
	"context"
	"errors"
	"strings"

	"go-backend/internal/core/apperr"
)

// LoginUseCase 收敛登录用例编排（包含可选的登录验证码校验）。
type LoginUseCase struct {
	svc            *Service
	captchaPolicy  LoginCaptchaPolicy
	captchaVerifier CaptchaVerifier
}

func NewLoginUseCase(
	svc *Service,
	captchaPolicy LoginCaptchaPolicy,
	captchaVerifier CaptchaVerifier,
) *LoginUseCase {
	return &LoginUseCase{
		svc:             svc,
		captchaPolicy:   captchaPolicy,
		captchaVerifier: captchaVerifier,
	}
}

func (u *LoginUseCase) Login(ctx context.Context, req LoginRequest) (*LoginResponse, *Error) {
	if u == nil || u.svc == nil {
		return nil, &Error{Code: "500", Msg: "认证服务未初始化"}
	}

	authType := strings.ToUpper(strings.TrimSpace(req.AuthType))
	if authType == "" || authType == "ACCOUNT" {
		enabled, err := u.isCaptchaEnabled(ctx)
		if err != nil {
			return nil, err
		}
		if enabled {
			if strings.TrimSpace(req.Captcha) == "" {
				return nil, &Error{Code: "400", Msg: "验证码不能为空"}
			}
			if strings.TrimSpace(req.UUID) == "" {
				return nil, &Error{Code: "400", Msg: "验证码标识不能为空"}
			}
			if u.captchaVerifier == nil {
				return nil, &Error{Code: "500", Msg: "验证码服务未初始化"}
			}
			ok, verr := u.captchaVerifier.VerifyAndConsume(ctx, strings.TrimSpace(req.UUID), strings.TrimSpace(req.Captcha))
			if verr != nil {
				return nil, apperr.Wrap("500", "验证码校验失败", verr)
			}
			if !ok {
				return nil, &Error{Code: "400", Msg: "验证码不正确或已过期"}
			}
		}
	}

	return u.svc.Login(ctx, req)
}

func (u *LoginUseCase) isCaptchaEnabled(ctx context.Context) (bool, *Error) {
	if u == nil || u.captchaPolicy == nil {
		return false, nil
	}
	enabled, err := u.captchaPolicy.IsEnabled(ctx)
	if err == nil {
		return enabled, nil
	}
	// 若上游已经是应用错误，则直接透传。
	var ae *apperr.Error
	if errors.As(err, &ae) && ae != nil && ae.Code != "" {
		return false, ae
	}
	return false, apperr.Wrap("500", "查询登录验证码配置失败", err)
}
