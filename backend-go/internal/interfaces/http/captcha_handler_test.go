package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type captchaResp struct {
	UUID       string `json:"uuid"`
	Img        string `json:"img"`
	ExpireTime int64  `json:"expireTime"`
	IsEnabled  bool   `json:"isEnabled"`
}

func TestGetImageCaptcha_Enabled_RequiresRedis(t *testing.T) {
	gin.SetMode(gin.TestMode)

	database, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	mock.ExpectQuery("SELECT COALESCE\\(value, default_value, '0'\\) AS val").
		WillReturnRows(sqlmock.NewRows([]string{"val"}).AddRow("1"))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/captcha/image", nil)

	h := NewCaptchaHandler(database, nil)
	h.GetImageCaptcha(c)

	var resp apiResp
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Code != "500" {
		t.Fatalf("expected code=500, got %s (msg=%s)", resp.Code, resp.Msg)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
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

	database, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	mock.ExpectQuery("SELECT COALESCE\\(value, default_value, '0'\\) AS val").
		WillReturnRows(sqlmock.NewRows([]string{"val"}).AddRow("1"))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/captcha/image", nil)

	h := NewCaptchaHandler(database, rdb)
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
	if got, err := mr.Get(buildCaptchaRedisKey(data.UUID)); err != nil || got == "" {
		t.Fatalf("expected redis captcha value written")
	}
	if ttl := mr.TTL(buildCaptchaRedisKey(data.UUID)); ttl <= 0 || ttl > 2*time.Minute {
		t.Fatalf("unexpected ttl: %v", ttl)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}
