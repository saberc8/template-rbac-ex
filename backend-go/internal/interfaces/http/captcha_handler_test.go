package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	appsystem "go-backend/internal/application/system"
	"go-backend/internal/core/captcha"
	domainsys "go-backend/internal/domain/system"
)

type captchaResp struct {
	UUID       string `json:"uuid"`
	Img        string `json:"img"`
	ExpireTime int64  `json:"expireTime"`
	IsEnabled  bool   `json:"isEnabled"`
}

func TestGetImageCaptcha_Enabled_RequiresRedis(t *testing.T) {
	gin.SetMode(gin.TestMode)

	sysSvc := appsystem.NewService(nil, &fakeOptionRepo{val: "1", found: true}, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/captcha/image", nil)

	h := NewCaptchaHandler(sysSvc, nil)
	h.GetImageCaptcha(c)

	var resp apiResp
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Code != "500" {
		t.Fatalf("expected code=500, got %s (msg=%s)", resp.Code, resp.Msg)
	}
}

func TestGetImageCaptcha_Enabled_WritesToRedis(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	sysSvc := appsystem.NewService(nil, &fakeOptionRepo{val: "1", found: true}, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/captcha/image", nil)

	h := NewCaptchaHandler(sysSvc, rdb)
	h.GetImageCaptcha(c)

	var resp apiResp
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Code != "200" {
		t.Fatalf("expected code=200, got %s (msg=%s)", resp.Code, resp.Msg)
	}

	var data captchaResp
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("unmarshal data: %v", err)
	}
	if !data.IsEnabled {
		t.Fatalf("expected isEnabled=true")
	}
	if data.UUID == "" {
		t.Fatalf("expected uuid non-empty")
	}
	if got, err := mr.Get(captcha.BuildRedisKey(data.UUID)); err != nil || got == "" {
		t.Fatalf("expected redis captcha value written")
	}
	if ttl := mr.TTL(captcha.BuildRedisKey(data.UUID)); ttl <= 0 || ttl > 2*time.Minute {
		t.Fatalf("unexpected ttl: %v", ttl)
	}
}

type fakeOptionRepo struct {
	val   string
	found bool
}

func (f *fakeOptionRepo) List(context.Context, domainsys.OptionListFilter) ([]domainsys.OptionView, error) {
	return nil, nil
}

func (f *fakeOptionRepo) GetMergedValue(context.Context, string) (string, bool, error) {
	return f.val, f.found, nil
}

func (f *fakeOptionRepo) UpdateValues(context.Context, int64, []domainsys.OptionUpdate) error {
	return nil
}

func (f *fakeOptionRepo) ResetValues(context.Context, domainsys.OptionResetFilter) error {
	return nil
}
