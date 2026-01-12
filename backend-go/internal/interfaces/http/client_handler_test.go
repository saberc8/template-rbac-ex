package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
)

type apiResp struct {
	Code    string          `json:"code"`
	Msg     string          `json:"msg"`
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
}

func TestClientList_InvalidPage_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	req := httptest.NewRequest(http.MethodGet, "/system/client?page=abc", nil)
	c.Request = req

	h := NewClientHandler(nil)
	h.ListClientPage(c)

	var resp apiResp
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Code != "400" {
		t.Fatalf("expected code=400, got %s (msg=%s)", resp.Code, resp.Msg)
	}
}

func TestClientList_StatusZero_IsFilterable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM sys_client AS c WHERE 1=1 AND c.status = $1")).
		WithArgs(int64(0)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(0)))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/system/client?status=0", nil)

	h := NewClientHandler(db)
	h.ListClientPage(c)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestClientList_AuthType_UsesJsonbContainment(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM sys_client AS c WHERE 1=1 AND (c.auth_type::jsonb @> $1::jsonb)")).
		WithArgs(`["ACCOUNT"]`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(0)))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/system/client?authType=ACCOUNT", nil)

	h := NewClientHandler(db)
	h.ListClientPage(c)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}
