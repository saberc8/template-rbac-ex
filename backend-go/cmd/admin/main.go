package main

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	docs "voc-go-backend/docs"
	appauth "voc-go-backend/internal/application/auth"
	appdict "voc-go-backend/internal/application/dict"
	rbacdomain "voc-go-backend/internal/domain/rbac"
	"voc-go-backend/internal/domain/user"
	"voc-go-backend/internal/infrastructure/cache"
	"voc-go-backend/internal/infrastructure/db"
	"voc-go-backend/internal/infrastructure/id"
	dictp "voc-go-backend/internal/infrastructure/persistence/dict"
	rbacp "voc-go-backend/internal/infrastructure/persistence/rbac"
	syslogp "voc-go-backend/internal/infrastructure/persistence/syslog"
	persistence "voc-go-backend/internal/infrastructure/persistence/user"
	"voc-go-backend/internal/infrastructure/security"
	httpif "voc-go-backend/internal/interfaces/http"
)

// @title voc-go-backend 接口文档
// @version 1.0
// @description Avalon 平台 Go 后端接口文档，涵盖认证、系统管理、日志等模块。
// @BasePath /
// @schemes http
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

func main() {
	loadDotenvForDev()

	// 1. 初始化数据库连接（PostgreSQL）
	dbCfg := db.LoadConfigFromEnv()
	pg, err := db.NewPostgres(dbCfg)
	if err != nil {
		log.Fatalf("failed to connect postgres: %v", err)
	}
	defer pg.Close()

	// 1.0 初始化 Redis 连接（验证码等缓存使用）
	redisCfg := cache.LoadConfigFromEnv()
	redisClient, err := cache.NewRedis(redisCfg)
	if err != nil {
		log.Fatalf("failed to connect redis: %v", err)
	}
	defer redisClient.Close()

	// 1.1 自动迁移/初始化数据库（仅 sys_user 和默认 admin）
	if err := db.AutoMigrate(pg); err != nil {
		log.Fatalf("failed to auto-migrate database: %v", err)
	}

	// 2. 初始化安全组件：RSA 解密器、BCrypt 密码校验、JWT 生成器
	rsaDecryptor, err := newRSADecryptorFromEnv()
	if err != nil {
		log.Fatalf("failed to init RSA decryptor: %v", err)
	}
	pwdVerifier := security.BcryptVerifier{}
	pwdHasher := security.BcryptHasher{}

	jwtSecret := mustGetenv("AUTH_JWT_SECRET")
	tokenTTL := 24 * time.Hour
	tokenSvc := security.NewTokenService(jwtSecret, tokenTTL)

	// 3. 初始化领域仓储和应用服务
	var userRepo user.Repository = persistence.NewPgRepository(pg)
	var roleRepo rbacdomain.RoleRepository = rbacp.NewPgRoleRepository(pg)
	var menuRepo rbacdomain.MenuRepository = rbacp.NewPgMenuRepository(pg)
	authSvc := appauth.NewService(userRepo, rsaDecryptor, pwdVerifier, tokenSvc)
	dictRepo := dictp.NewPgRepository(pg)
	dictSvc := appdict.NewService(dictRepo, id.Next)

	// 4. 初始化 HTTP 服务（Gin）
	r := gin.Default()

	// 全局 CORS（开发阶段允许前端本地调试）
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		// 只在本地开发时放开 localhost:3000，如需更多域名可按需扩展
		if origin == "http://localhost:3000" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		// 预检请求直接返回
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 全局鉴权上下文：如携带 token 且合法，则写入 userID 到 Gin Context。
	r.Use(httpif.AuthContext(tokenSvc))

	// 系统操作日志中间件：在业务处理前后统一记录 sys_log。
	sysLogRepo := syslogp.NewPgRepository(pg)
	r.Use(httpif.NewSysLogMiddleware(sysLogRepo, tokenSvc))

	// 在线用户内存存储（仅当前进程有效）
	onlineStore := httpif.NewOnlineStore()

	// 公共接口
	commonHandler := httpif.NewCommonHandler(pg)
	commonHandler.RegisterCommonRoutes(r)

	// 验证码接口（登录图片验证码）
	captchaHandler := httpif.NewCaptchaHandler(pg, redisClient)
	captchaHandler.RegisterCaptchaRoutes(r)

	// 登录与用户接口
	authHandler := httpif.NewAuthHandler(authSvc, onlineStore, pg, redisClient)
	authHandler.RegisterAuthRoutes(r)
	userHandler := httpif.NewUserHandler(userRepo, roleRepo, menuRepo)
	userHandler.RegisterUserRoutes(r)

	// 系统监控：在线用户
	onlineUserHandler := httpif.NewOnlineUserHandler(onlineStore)
	onlineUserHandler.RegisterOnlineUserRoutes(r)

	// 系统管理：菜单管理
	menuHandler := httpif.NewMenuHandler(pg)
	menuHandler.RegisterMenuRoutes(r)

	// 系统管理：角色管理
	roleHandler := httpif.NewRoleHandler(pg)
	roleHandler.RegisterRoleRoutes(r)

	// 系统管理：部门管理（仅树查询）
	deptHandler := httpif.NewDeptHandler(pg)
	deptHandler.RegisterDeptRoutes(r)

	// 系统管理：用户管理
	systemUserHandler := httpif.NewSystemUserHandler(pg, rsaDecryptor, pwdHasher)
	systemUserHandler.RegisterSystemUserRoutes(r)

	// 系统管理：字典管理
	dictHandler := httpif.NewDictHandler(dictSvc)
	dictHandler.RegisterDictRoutes(r)

	// 系统管理：系统配置（参数管理）
	optionHandler := httpif.NewOptionHandler(pg)
	optionHandler.RegisterOptionRoutes(r)

	// 系统管理：文件管理
	fileHandler := httpif.NewFileHandler(pg)
	fileHandler.RegisterFileRoutes(r)

	// 系统管理：存储配置（需要 RSA 解密存储密钥）
	storageHandler := httpif.NewStorageHandler(pg, rsaDecryptor)
	storageHandler.RegisterStorageRoutes(r)

	// 系统管理：客户端配置
	clientHandler := httpif.NewClientHandler(pg)
	clientHandler.RegisterClientRoutes(r)

	// 系统监控：系统日志
	logHandler := httpif.NewLogHandler(pg)
	logHandler.RegisterLogRoutes(r)

	// 静态文件访问（上传文件）
	fileRoot := getenvDefault("FILE_STORAGE_DIR", "./data/file")
	r.Static("/file", fileRoot)

	// Swagger 接口文档
	// 访问地址示例：http://localhost:4398/swagger/index.html
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// 5. 启动 HTTP 服务
	port := getenvDefault("HTTP_PORT", "4398")
	// 在启动前设置 swagger 文档的 Host，便于在 UI 中调试。
	docs.SwaggerInfo.Host = "localhost:" + port
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to start http server: %v", err)
	}
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func newRSADecryptorFromEnv() (*security.RSADecryptor, error) {
	if pemPath := strings.TrimSpace(os.Getenv("AUTH_RSA_PRIVATE_KEY_FILE")); pemPath != "" {
		return security.NewRSADecryptorFromPEMFile(pemPath)
	}
	return security.NewRSADecryptorFromBase64(mustGetenv("AUTH_RSA_PRIVATE_KEY"))
}

func mustGetenv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("missing required env var: %s", key)
	}
	return v
}

func loadDotenvForDev() {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if env == "prod" || env == "production" {
		return
	}
	if err := godotenv.Load(); err != nil {
		// .env is optional; skip silently when missing.
	}
}
