package http

import (
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestRedisCaptchaStore_SetGetVerify(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis.Run: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	store := NewRedisCaptchaStore(rdb, 2*time.Minute)

	if err := store.Set("id1", "1234"); err != nil {
		t.Fatalf("set: %v", err)
	}
	if v := store.Get("id1", false); v != "1234" {
		t.Fatalf("get expected 1234, got %q", v)
	}
	if ok := store.Verify("id1", "1234", false); !ok {
		t.Fatalf("verify expected true")
	}
	if v := store.Get("id1", true); v != "1234" {
		t.Fatalf("get(clear) expected 1234, got %q", v)
	}
	if v := store.Get("id1", false); v != "" {
		t.Fatalf("expected cleared value to be empty, got %q", v)
	}
}
