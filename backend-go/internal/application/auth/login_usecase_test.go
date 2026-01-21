package auth

import (
	"context"
	"testing"
	"time"

	"go-backend/internal/core/apperr"
	domainuser "go-backend/internal/domain/user"
)

type stubCaptchaPolicy struct {
	enabled bool
	err     error
	called  int
}

func (s *stubCaptchaPolicy) IsEnabled(ctx context.Context) (bool, error) {
	s.called++
	if s.err != nil {
		return false, s.err
	}
	return s.enabled, nil
}

type stubCaptchaVerifier struct {
	ok     bool
	err    error
	called int
}

func (s *stubCaptchaVerifier) VerifyAndConsume(ctx context.Context, id, answer string) (bool, error) {
	s.called++
	if s.err != nil {
		return false, s.err
	}
	return s.ok, nil
}

func newLoginSvcForTest(t *testing.T) *Service {
	t.Helper()
	now := time.Now()
	u := &domainuser.User{
		ID:         123,
		Username:   "u1",
		Nickname:   "n1",
		Password:   "hash",
		Status:     1,
		CreateTime: now,
	}
	repo := stubUserRepo{byUsername: map[string]*domainuser.User{"u1": u}}
	return NewService(repo, stubPwdVerifier{ok: true}, stubTokenGen{token: "t1"})
}

func TestLoginUseCase_CaptchaDisabled_SkipsVerify(t *testing.T) {
	svc := newLoginSvcForTest(t)
	policy := &stubCaptchaPolicy{enabled: false}
	verifier := &stubCaptchaVerifier{ok: true}
	uc := NewLoginUseCase(svc, policy, verifier)

	resp, err := uc.Login(context.Background(), LoginRequest{
		AuthType: "ACCOUNT",
		ClientID: "c1",
		Username: "u1",
		Password: "raw",
		UUID:     "",
		Captcha:  "",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil || resp.Token != "t1" {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if policy.called != 1 {
		t.Fatalf("expected policy called once, got %d", policy.called)
	}
	if verifier.called != 0 {
		t.Fatalf("expected verifier not called, got %d", verifier.called)
	}
}

func TestLoginUseCase_CaptchaEnabled_VerifyOK(t *testing.T) {
	svc := newLoginSvcForTest(t)
	policy := &stubCaptchaPolicy{enabled: true}
	verifier := &stubCaptchaVerifier{ok: true}
	uc := NewLoginUseCase(svc, policy, verifier)

	resp, err := uc.Login(context.Background(), LoginRequest{
		AuthType: "ACCOUNT",
		ClientID: "c1",
		Username: "u1",
		Password: "raw",
		UUID:     "id1",
		Captcha:  "1234",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil || resp.Token != "t1" {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if verifier.called != 1 {
		t.Fatalf("expected verifier called once, got %d", verifier.called)
	}
}

func TestLoginUseCase_CaptchaEnabled_MissingCaptcha(t *testing.T) {
	svc := newLoginSvcForTest(t)
	policy := &stubCaptchaPolicy{enabled: true}
	verifier := &stubCaptchaVerifier{ok: true}
	uc := NewLoginUseCase(svc, policy, verifier)

	_, err := uc.Login(context.Background(), LoginRequest{
		AuthType: "ACCOUNT",
		ClientID: "c1",
		Username: "u1",
		Password: "raw",
		UUID:     "id1",
		Captcha:  "",
	})
	if err == nil || err.Code != "400" || err.Msg != "验证码不能为空" {
		t.Fatalf("unexpected error: %v", err)
	}
	if verifier.called != 0 {
		t.Fatalf("expected verifier not called, got %d", verifier.called)
	}
}

func TestLoginUseCase_CaptchaEnabled_MissingUUID(t *testing.T) {
	svc := newLoginSvcForTest(t)
	policy := &stubCaptchaPolicy{enabled: true}
	verifier := &stubCaptchaVerifier{ok: true}
	uc := NewLoginUseCase(svc, policy, verifier)

	_, err := uc.Login(context.Background(), LoginRequest{
		AuthType: "ACCOUNT",
		ClientID: "c1",
		Username: "u1",
		Password: "raw",
		UUID:     "",
		Captcha:  "1234",
	})
	if err == nil || err.Code != "400" || err.Msg != "验证码标识不能为空" {
		t.Fatalf("unexpected error: %v", err)
	}
	if verifier.called != 0 {
		t.Fatalf("expected verifier not called, got %d", verifier.called)
	}
}

func TestLoginUseCase_CaptchaEnabled_VerifyFail(t *testing.T) {
	svc := newLoginSvcForTest(t)
	policy := &stubCaptchaPolicy{enabled: true}
	verifier := &stubCaptchaVerifier{ok: false}
	uc := NewLoginUseCase(svc, policy, verifier)

	_, err := uc.Login(context.Background(), LoginRequest{
		AuthType: "ACCOUNT",
		ClientID: "c1",
		Username: "u1",
		Password: "raw",
		UUID:     "id1",
		Captcha:  "1234",
	})
	if err == nil || err.Code != "400" || err.Msg != "验证码不正确或已过期" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoginUseCase_CaptchaEnabled_VerifyError(t *testing.T) {
	svc := newLoginSvcForTest(t)
	policy := &stubCaptchaPolicy{enabled: true}
	verifier := &stubCaptchaVerifier{ok: false, err: context.Canceled}
	uc := NewLoginUseCase(svc, policy, verifier)

	_, err := uc.Login(context.Background(), LoginRequest{
		AuthType: "ACCOUNT",
		ClientID: "c1",
		Username: "u1",
		Password: "raw",
		UUID:     "id1",
		Captcha:  "1234",
	})
	if err == nil || err.Code != "500" || err.Msg != "验证码校验失败" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoginUseCase_CaptchaPolicyError_Passthrough(t *testing.T) {
	svc := newLoginSvcForTest(t)
	policy := &stubCaptchaPolicy{err: apperr.New("500", "查询登录验证码配置失败")}
	verifier := &stubCaptchaVerifier{ok: true}
	uc := NewLoginUseCase(svc, policy, verifier)

	_, err := uc.Login(context.Background(), LoginRequest{
		AuthType: "ACCOUNT",
		ClientID: "c1",
		Username: "u1",
		Password: "raw",
	})
	if err == nil || err.Code != "500" || err.Msg != "查询登录验证码配置失败" {
		t.Fatalf("unexpected error: %v", err)
	}
}

