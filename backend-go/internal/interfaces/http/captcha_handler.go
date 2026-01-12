package http

import (
	"context"
	"database/sql"
	"image/color"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mojocn/base64Captcha"
	"github.com/redis/go-redis/v9"
)

// CaptchaResp matches the Java CaptchaResp structure.
type CaptchaResp struct {
	UUID       string `json:"uuid"`
	Img        string `json:"img"`
	ExpireTime int64  `json:"expireTime"`
	IsEnabled  bool   `json:"isEnabled"`
}

// CaptchaHandler exposes /captcha endpoints.
type CaptchaHandler struct {
	db    *sql.DB
	redis *redis.Client
}

// NewCaptchaHandler 创建验证码处理器。
// 目前仅实现登录图片验证码，与 Java 版 /captcha/image 行为保持一致：
// - 读取 sys_option 表中的 LOGIN_CAPTCHA_ENABLED 判断是否启用登录验证码；
// - 启用时生成 Base64 图片验证码并返回 uuid、图片与过期时间；
// - 未启用时仅返回 isEnabled=false，前端据此隐藏验证码输入框。
func NewCaptchaHandler(db *sql.DB, redisClient *redis.Client) *CaptchaHandler {
	return &CaptchaHandler{db: db, redis: redisClient}
}

// RegisterCaptchaRoutes registers /captcha endpoints.
func (h *CaptchaHandler) RegisterCaptchaRoutes(r *gin.Engine) {
	r.GET("/captcha/image", h.GetImageCaptcha)
}

// GetImageCaptcha 获取登录图片验证码。
// 行为与 Java CaptchaController#getImageCaptcha 基本保持一致：
// - 当 LOGIN_CAPTCHA_ENABLED=0 时，仅返回 isEnabled=false；
// - 当 LOGIN_CAPTCHA_ENABLED!=0 时，生成一条 4 位数字验证码和 Base64 图片。
func (h *CaptchaHandler) GetImageCaptcha(c *gin.Context) {
	const graphicCaptchaExpirationMinutes = 2

	enabled, err := isLoginCaptchaEnabled(c.Request.Context(), h.db)
	if err != nil {
		Fail(c, "500", "查询登录验证码配置失败")
		return
	}

	// 未启用登录验证码时，仅返回 isEnabled=false，保持与 Java 逻辑一致。
	if !enabled {
		now := time.Now().Add(graphicCaptchaExpirationMinutes * time.Minute).UnixMilli()
		resp := CaptchaResp{
			UUID:       "",
			Img:        "",
			ExpireTime: now,
			IsEnabled:  false,
		}
		OK(c, resp)
		return
	}

	// 启用验证码：生成更清晰的纯数字验证码（不修改前端接口，仅优化图片可读性）。
	//
	// 说明：
	// - DriverDigit 固定带波形扭曲与大量干扰点，容易导致不清晰；
	// - 这里改用 DriverString（仅数字），并默认减少干扰、增大尺寸提升可读性。
	driver := newClearDigitCaptchaDriver()
	captcha := base64Captcha.NewCaptcha(driver, base64Captcha.DefaultMemStore)

	id, b64s, answer, err := captcha.Generate()
	if err != nil {
		Fail(c, "500", "生成验证码失败")
		return
	}

	// 将验证码内容写入 Redis，使用与 Java 一致的前缀：CAPTCHA:{uuid}
	if h.redis != nil {
		key := buildCaptchaRedisKey(id)
		ctx := c.Request.Context()
		if err := h.redis.Set(ctx, key, answer, graphicCaptchaExpirationMinutes*time.Minute).Err(); err != nil {
			Fail(c, "500", "保存验证码失败")
			return
		}
	}

	expireTime := time.Now().Add(graphicCaptchaExpirationMinutes * time.Minute).UnixMilli()
	img := b64s
	// 如果第三方库已经返回完整 data URL，则直接使用；否则补上前缀。
	if !strings.HasPrefix(img, "data:image") {
		img = "data:image/png;base64," + img
	}
	resp := CaptchaResp{
		UUID:       id,
		Img:        img,
		ExpireTime: expireTime,
		IsEnabled:  true,
	}
	OK(c, resp)
}

// buildCaptchaRedisKey 构建验证码在 Redis 中的 key。
// 对齐 Java 侧 CacheConstants.CAPTCHA_KEY_PREFIX：CAPTCHA:{uuid}
func buildCaptchaRedisKey(id string) string {
	const prefix = "CAPTCHA:"
	return prefix + id
}

// isLoginCaptchaEnabled 读取 sys_option 中的 LOGIN_CAPTCHA_ENABLED 配置。
// 返回 true 表示启用登录验证码，false 表示关闭。
func isLoginCaptchaEnabled(ctx context.Context, db *sql.DB) (bool, error) {
	const query = `
SELECT COALESCE(value, default_value, '0') AS val
FROM sys_option
WHERE code = 'LOGIN_CAPTCHA_ENABLED'
LIMIT 1;
`
	var val string
	err := db.QueryRowContext(ctx, query).Scan(&val)
	if err != nil {
		if err == sql.ErrNoRows {
			// 未找到配置时视为未开启验证码。
			return false, nil
		}
		return false, err
	}
	val = strings.TrimSpace(val)
	return val != "" && val != "0", nil
}

func newClearDigitCaptchaDriver() base64Captcha.Driver {
	// 不改前端：长度保持 4 位。
	const length = 4

	height := getenvInt("CAPTCHA_IMG_HEIGHT", 60)
	width := getenvInt("CAPTCHA_IMG_WIDTH", 200)
	noiseCount := getenvInt("CAPTCHA_NOISE_COUNT", 0)
	showLineOptions := getenvInt("CAPTCHA_SHOW_LINE_OPTIONS", 0)

	// 优先使用更易读的数字集合，避免 0/1 等歧义字符。
	source := strings.TrimSpace(os.Getenv("CAPTCHA_SOURCE"))
	if source == "" {
		source = "23456789"
	}

	bg := &color.RGBA{R: 255, G: 255, B: 255, A: 255}
	return base64Captcha.NewDriverString(
		height,
		width,
		noiseCount,
		showLineOptions,
		length,
		source,
		bg,
		nil,
		nil,
	)
}

func getenvInt(key string, def int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	if v <= 0 {
		return def
	}
	return v
}
