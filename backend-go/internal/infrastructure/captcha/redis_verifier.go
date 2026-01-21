package captcha

import (
	"context"
	"errors"
	"strings"

	"github.com/redis/go-redis/v9"

	corecaptcha "go-backend/internal/core/captcha"
)

type RedisVerifier struct {
	redis *redis.Client
}

func NewRedisVerifier(redisClient *redis.Client) *RedisVerifier {
	return &RedisVerifier{redis: redisClient}
}

// VerifyAndConsume 校验验证码并在校验成功后删除对应 key，避免重复使用。
// 返回值:
// - ok=true: 校验通过且已消费
// - ok=false 且 err=nil: 验证码不正确或已过期
func (v *RedisVerifier) VerifyAndConsume(ctx context.Context, id, answer string) (bool, error) {
	if v == nil || v.redis == nil {
		return false, errors.New("captcha verifier not initialized")
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return false, nil
	}
	key := corecaptcha.BuildRedisKey(id)
	val, err := v.redis.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false, nil
		}
		return false, err
	}
	if !strings.EqualFold(strings.TrimSpace(answer), strings.TrimSpace(val)) {
		return false, nil
	}
	_, _ = v.redis.Del(ctx, key).Result()
	return true, nil
}

