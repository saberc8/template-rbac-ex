package bootstrap

import (
	"context"

	appsystem "go-backend/internal/application/system"
	"go-backend/internal/core/apperr"
)

type loginCaptchaPolicy struct {
	sysSvc *appsystem.Service
}

func (p loginCaptchaPolicy) IsEnabled(ctx context.Context) (bool, error) {
	if p.sysSvc == nil {
		return false, nil
	}
	enabled, derr := p.sysSvc.IsOptionEnabled(ctx, "LOGIN_CAPTCHA_ENABLED")
	if derr != nil {
		code := derr.Code
		if code == "" {
			code = "500"
		}
		return false, apperr.Wrap(code, "查询登录验证码配置失败", derr)
	}
	return enabled, nil
}

