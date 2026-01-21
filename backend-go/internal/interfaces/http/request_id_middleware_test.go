package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequestID_GeneratesWhenMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(RequestID())
	r.GET("/", func(c *gin.Context) {
		id, ok := GetRequestID(c)
		if !ok || id == "" {
			t.Fatalf("expected request-id in context")
		}
		c.String(http.StatusOK, id)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)

	gotHeader := w.Header().Get(headerRequestIDName)
	if gotHeader == "" {
		t.Fatalf("expected %s response header set", headerRequestIDName)
	}
	if w.Body.String() != gotHeader {
		t.Fatalf("expected body=%q to equal header=%q", w.Body.String(), gotHeader)
	}
}

func TestRequestID_PreservesUpstream(t *testing.T) {
	gin.SetMode(gin.TestMode)

	const upstream = "upstream-id-123"

	r := gin.New()
	r.Use(RequestID())
	r.GET("/", func(c *gin.Context) {
		id, ok := GetRequestID(c)
		if !ok || id == "" {
			t.Fatalf("expected request-id in context")
		}
		c.String(http.StatusOK, id)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(headerRequestIDName, upstream)
	r.ServeHTTP(w, req)

	gotHeader := w.Header().Get(headerRequestIDName)
	if gotHeader != upstream {
		t.Fatalf("expected %s=%q, got %q", headerRequestIDName, upstream, gotHeader)
	}
	if w.Body.String() != upstream {
		t.Fatalf("expected body=%q", upstream)
	}
}

