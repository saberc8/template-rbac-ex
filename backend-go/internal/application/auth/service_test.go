package auth

import (
	"context"
	"testing"
	"time"

	domainuser "voc-go-backend/internal/domain/user"
)

type stubUserRepo struct {
	byUsername map[string]*domainuser.User
	byID       map[int64]*domainuser.User
	err        error
}

func (s stubUserRepo) GetByUsername(ctx context.Context, username string) (*domainuser.User, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.byUsername[username], nil
}

func (s stubUserRepo) GetByID(ctx context.Context, id int64) (*domainuser.User, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.byID[id], nil
}

type stubPwdVerifier struct {
	ok  bool
	err error
}

func (s stubPwdVerifier) Verify(raw, encoded string) (bool, error) {
	if s.err != nil {
		return false, s.err
	}
	return s.ok, nil
}

type stubTokenGen struct {
	token string
	err   error
}

func (s stubTokenGen) Generate(userID int64) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	return s.token, nil
}

func TestService_Login_OK(t *testing.T) {
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
	svc := NewService(repo, stubPwdVerifier{ok: true}, stubTokenGen{token: "t1"})

	resp, err := svc.Login(context.Background(), LoginRequest{
		AuthType: "ACCOUNT",
		ClientID: "c1",
		Username: "u1",
		Password: "raw",
		Captcha:  "",
		UUID:     "",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if resp == nil {
		t.Fatalf("expected response")
	}
	if resp.Token != "t1" || resp.UserID != 123 || resp.Username != "u1" || resp.Nickname != "n1" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestService_Login_Uninitialized(t *testing.T) {
	repo := stubUserRepo{}
	svc := NewService(repo, nil, nil)
	_, err := svc.Login(context.Background(), LoginRequest{ClientID: "c1", Username: "u1", Password: "raw"})
	if err == nil || err.Error() != "认证服务未初始化" {
		t.Fatalf("expected init error, got %v", err)
	}
}
