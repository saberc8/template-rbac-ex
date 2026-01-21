package captcha

// BuildRedisKey 构建验证码在 Redis 中的 key。
// 对齐 Java 侧 CacheConstants.CAPTCHA_KEY_PREFIX：CAPTCHA:{uuid}
func BuildRedisKey(id string) string {
	const prefix = "CAPTCHA:"
	return prefix + id
}

