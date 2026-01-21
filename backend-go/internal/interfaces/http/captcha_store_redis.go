package http

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/mojocn/base64Captcha"
	"github.com/redis/go-redis/v9"

	"go-backend/internal/core/captcha"
)

var _ base64Captcha.Store = (*RedisCaptchaStore)(nil)

type RedisCaptchaStore struct {
	redis *redis.Client
	ttl   time.Duration
}

func NewRedisCaptchaStore(redisClient *redis.Client, ttl time.Duration) *RedisCaptchaStore {
	if ttl <= 0 {
		ttl = 2 * time.Minute
	}
	return &RedisCaptchaStore{redis: redisClient, ttl: ttl}
}

func (s *RedisCaptchaStore) Set(id string, value string) error {
	if s == nil || s.redis == nil {
		return errors.New("redis captcha store not initialized")
	}
	ctx := context.Background()
	return s.redis.Set(ctx, captcha.BuildRedisKey(id), value, s.ttl).Err()
}

func (s *RedisCaptchaStore) Get(id string, clear bool) string {
	if s == nil || s.redis == nil {
		return ""
	}
	ctx := context.Background()
	key := captcha.BuildRedisKey(id)
	val, err := s.redis.Get(ctx, key).Result()
	if err != nil {
		return ""
	}
	if clear {
		_, _ = s.redis.Del(ctx, key).Result()
	}
	return val
}

func (s *RedisCaptchaStore) Verify(id, answer string, clear bool) bool {
	v := s.Get(id, clear)
	return strings.EqualFold(strings.TrimSpace(v), strings.TrimSpace(answer))
}
