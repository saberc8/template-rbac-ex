package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	appclient "voc-go-backend/internal/application/client"
	domainclient "voc-go-backend/internal/domain/client"
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
	var got domainclient.PageQuery
	repo := &fakeClientRepo{
		pageFn: func(q domainclient.PageQuery) domainclient.PageResult {
			got = q
			return domainclient.PageResult{List: []domainclient.ClientDetail{}, Total: 0}
		},
	}
	svc := appclient.NewService(repo, func() int64 { return 1 })

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/system/client?status=0", nil)

	h := NewClientHandler(svc)
	h.ListClientPage(c)

	if got.Status == nil || *got.Status != 0 {
		t.Fatalf("expected status=0, got %#v", got.Status)
	}
}

func TestClientList_AuthType_UsesJsonbContainment(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var got domainclient.PageQuery
	repo := &fakeClientRepo{
		pageFn: func(q domainclient.PageQuery) domainclient.PageResult {
			got = q
			return domainclient.PageResult{List: []domainclient.ClientDetail{}, Total: 0}
		},
	}
	svc := appclient.NewService(repo, func() int64 { return 1 })

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/system/client?authType=ACCOUNT", nil)

	h := NewClientHandler(svc)
	h.ListClientPage(c)

	if len(got.AuthType) != 1 || got.AuthType[0] != "ACCOUNT" {
		t.Fatalf("expected authType=[ACCOUNT], got %#v", got.AuthType)
	}
}

type fakeClientRepo struct {
	pageFn func(q domainclient.PageQuery) domainclient.PageResult
}

func (f *fakeClientRepo) Page(_ context.Context, q domainclient.PageQuery) (domainclient.PageResult, error) {
	if f.pageFn != nil {
		return f.pageFn(q), nil
	}
	return domainclient.PageResult{List: []domainclient.ClientDetail{}, Total: 0}, nil
}

func (f *fakeClientRepo) Get(_ context.Context, _ int64) (*domainclient.ClientDetail, error) {
	return nil, nil
}

func (f *fakeClientRepo) Create(_ context.Context, _ *domainclient.Client) error {
	return nil
}

func (f *fakeClientRepo) Update(_ context.Context, _ *domainclient.Client) error {
	return nil
}

func (f *fakeClientRepo) Delete(_ context.Context, _ []int64) error {
	return nil
}
