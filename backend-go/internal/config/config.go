package config

// 包 config 负责加载并校验应用启动配置，统一处理开发环境的 .env 加载与默认值。

import (
	"errors"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"

	"go-backend/internal/infrastructure/cache"
	"go-backend/internal/infrastructure/db"
)

type Config struct {
	AppEnv         string
	HTTPPort       string
	FileStorageDir string
	AutoMigrate    bool

	AuthJWTSecret string

	DB    db.Config
	Redis cache.Config
}

// Load 从环境变量加载配置并做基本校验。
func Load() (Config, error) {
	loadDotenvForDev()

	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if appEnv == "" {
		appEnv = "dev"
	}

	cfg := Config{
		AppEnv:         appEnv,
		HTTPPort:       getenvDefault("HTTP_PORT", "14398"),
		FileStorageDir: getenvDefault("FILE_STORAGE_DIR", "./data/file"),
		AuthJWTSecret:  strings.TrimSpace(os.Getenv("AUTH_JWT_SECRET")),

		DB:    db.LoadConfigFromEnv(),
		Redis: cache.LoadConfigFromEnv(),
	}

	cfg.AutoMigrate = shouldAutoMigrate(cfg.AppEnv)

	if cfg.AuthJWTSecret == "" {
		return Config{}, errors.New("missing required env var: AUTH_JWT_SECRET")
	}
	if strings.TrimSpace(cfg.HTTPPort) == "" {
		cfg.HTTPPort = "14398"
	}
	return cfg, nil
}

// LoadDatabaseConfig 仅加载数据库配置，适用于 migrate 等不需要完整应用配置的场景。
func LoadDatabaseConfig() db.Config {
	loadDotenvForDev()
	return db.LoadConfigFromEnv()
}

func loadDotenvForDev() {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if env == "prod" || env == "production" {
		return
	}
	// .env 仅用于本地开发便利性，不存在时静默跳过。
	_ = godotenv.Load()
}

func shouldAutoMigrate(appEnv string) bool {
	v := strings.TrimSpace(os.Getenv("DB_AUTO_MIGRATE"))
	if v != "" {
		if b, ok := parseBool(v); ok {
			return b
		}
	}
	// 生产默认关闭隐式 DDL；开发默认保持“开箱即用”体验。
	return appEnv != "prod" && appEnv != "production"
}

func parseBool(v string) (bool, bool) {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "y", "on":
		return true, true
	case "0", "false", "no", "n", "off":
		return false, true
	default:
		// 兼容数字形式（非 0 视为 true）。
		if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			return n != 0, true
		}
		return false, false
	}
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
