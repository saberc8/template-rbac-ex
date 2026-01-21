package bootstrap

// 包 bootstrap 负责收敛应用装配与资源生命周期管理，避免 cmd/main 中手工 wiring 持续膨胀。

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	docs "go-backend/docs"
	appauth "go-backend/internal/application/auth"
	appclient "go-backend/internal/application/client"
	appdict "go-backend/internal/application/dict"
	apprbac "go-backend/internal/application/rbac"
	appstorage "go-backend/internal/application/storage"
	appsyslog "go-backend/internal/application/syslog"
	appsystem "go-backend/internal/application/system"
	appuser "go-backend/internal/application/user"
	"go-backend/internal/config"
	rbacdomain "go-backend/internal/domain/rbac"
	"go-backend/internal/domain/user"
	"go-backend/internal/infrastructure/cache"
	"go-backend/internal/infrastructure/db"
	"go-backend/internal/infrastructure/filestore"
	"go-backend/internal/infrastructure/id"
	clientp "go-backend/internal/infrastructure/persistence/client"
	dictp "go-backend/internal/infrastructure/persistence/dict"
	rbacp "go-backend/internal/infrastructure/persistence/rbac"
	storagep "go-backend/internal/infrastructure/persistence/storage"
	syslogp "go-backend/internal/infrastructure/persistence/syslog"
	systemp "go-backend/internal/infrastructure/persistence/system"
	persistence "go-backend/internal/infrastructure/persistence/user"
	"go-backend/internal/infrastructure/security"
	httpif "go-backend/internal/interfaces/http"
)

// BuildAdminApp 构建 admin HTTP 应用并返回关闭函数。
func BuildAdminApp(cfg config.Config) (*gin.Engine, func(), error) {
	// 1. 初始化数据库连接（PostgreSQL）
	pg, err := db.NewPostgres(cfg.DB)
	if err != nil {
		return nil, nil, err
	}

	// 1.0 初始化 Redis 连接（验证码等缓存使用）
	redisClient, err := cache.NewRedis(cfg.Redis)
	if err != nil {
		_ = pg.Close()
		return nil, nil, err
	}

	closeFn := func() {
		_ = redisClient.Close()
		_ = pg.Close()
	}

	// 1.1 自动迁移/初始化数据库（默认仅开发环境启用，生产需显式开关）
	if cfg.AutoMigrate {
		if err := db.AutoMigrate(pg); err != nil {
			closeFn()
			return nil, nil, err
		}
	}

	// 2. 初始化安全组件：BCrypt 密码校验、JWT 生成器
	pwdVerifier := security.BcryptVerifier{}
	pwdHasher := security.BcryptHasher{}

	tokenTTL := 24 * time.Hour
	tokenSvc := security.NewTokenService(cfg.AuthJWTSecret, tokenTTL)

	// 3. 初始化领域仓储和应用服务
	userPgRepo := persistence.NewPgRepository(pg)
	var userRepo user.Repository = userPgRepo
	roleRepo := rbacp.NewPgRoleRepository(pg)
	menuRepo := rbacp.NewPgMenuRepository(pg)
	var roleAuthRepo rbacdomain.RoleRepository = roleRepo
	var menuAuthRepo rbacdomain.MenuRepository = menuRepo
	authSvc := appauth.NewService(userRepo, pwdVerifier, tokenSvc)
	userQuerySvc := appauth.NewUserQueryService(userRepo, roleAuthRepo, menuAuthRepo)
	dictRepo := dictp.NewPgRepository(pg)
	dictSvc := appdict.NewService(dictRepo, id.Next)
	deptRepo := systemp.NewPgDeptRepository(pg)
	optionRepo := systemp.NewPgOptionRepository(pg)
	systemSvc := appsystem.NewService(deptRepo, optionRepo, id.Next)
	storageRepo := storagep.NewPgStorageRepository(pg)
	storageSvc := appstorage.NewService(storageRepo, id.Next)
	fileRepo := storagep.NewPgFileRepository(pg)
	fileStore := filestore.NewDefaultFileContentStore()
	fileSvc := appstorage.NewFileService(storageRepo, fileRepo, fileStore, id.Next)
	clientRepo := clientp.NewPgRepository(pg)
	clientSvc := appclient.NewService(clientRepo, id.Next)
	sysLogQueryRepo := syslogp.NewPgQueryRepository(pg)
	sysLogSvc := appsyslog.NewService(sysLogQueryRepo)
	menuSvc := apprbac.NewMenuService(menuRepo, id.Next)
	roleSvc := apprbac.NewRoleService(roleRepo, id.Next)
	userAdminSvc := appuser.NewAdminService(userPgRepo, roleRepo, id.Next, pwdHasher)

	// 4. 初始化 HTTP 服务（Gin）
	r := gin.Default()

	// request-id（写入响应头 + Gin Context），供日志链路追踪使用
	r.Use(httpif.RequestID())

	setupCORS(r)

	// 全局鉴权上下文：如携带 token 且合法，则写入 userID 到 Gin Context。
	r.Use(httpif.AuthContext(tokenSvc))

	// 系统操作日志中间件：在业务处理前后统一记录 sys_log。
	sysLogRepo := syslogp.NewPgRepository(pg)
	r.Use(httpif.NewSysLogMiddleware(sysLogRepo, tokenSvc))

	// 在线用户内存存储（仅当前进程有效）
	onlineStore := httpif.NewOnlineStore()

	registerHandlers(r, handlerDeps{
		redisClient: redisClient,
		tokenSvc:    tokenSvc,
		onlineStore: onlineStore,

		authSvc:      authSvc,
		userQuerySvc: userQuerySvc,
		systemSvc:    systemSvc,
		menuSvc:      menuSvc,
		roleSvc:      roleSvc,
		dictSvc:      dictSvc,
		userAdminSvc: userAdminSvc,
		storageSvc:   storageSvc,
		fileSvc:      fileSvc,
		clientSvc:    clientSvc,
		sysLogSvc:    sysLogSvc,

		fileRoot: cfg.FileStorageDir,
	})

	// 在启动前设置 swagger 文档的 Host，便于在 UI 中调试。
	docs.SwaggerInfo.Host = "localhost:" + cfg.HTTPPort

	// Swagger 接口文档
	// 访问地址示例：http://localhost:14398/swagger/index.html
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	return r, closeFn, nil
}

type handlerDeps struct {
	redisClient *redis.Client
	tokenSvc    *security.TokenService
	onlineStore *httpif.OnlineStore

	authSvc      *appauth.Service
	userQuerySvc *appauth.UserQueryService
	systemSvc    *appsystem.Service
	menuSvc      *apprbac.MenuService
	roleSvc      *apprbac.RoleService
	dictSvc      *appdict.Service
	userAdminSvc *appuser.AdminService
	storageSvc   *appstorage.Service
	fileSvc      *appstorage.FileService
	clientSvc    *appclient.Service
	sysLogSvc    *appsyslog.Service

	fileRoot string
}

func registerHandlers(r *gin.Engine, d handlerDeps) {
	if r == nil {
		return
	}

	// 公共接口
	commonHandler := httpif.NewCommonHandler(d.systemSvc, d.menuSvc, d.roleSvc, d.dictSvc, d.userAdminSvc)
	commonHandler.RegisterCommonRoutes(r)

	// 验证码接口（登录图片验证码）
	captchaHandler := httpif.NewCaptchaHandler(d.systemSvc, d.redisClient)
	captchaHandler.RegisterCaptchaRoutes(r)

	// 登录与用户接口
	authHandler := httpif.NewAuthHandler(d.authSvc, d.onlineStore, d.systemSvc, d.redisClient)
	authHandler.RegisterAuthRoutes(r)
	userHandler := httpif.NewUserHandler(d.userQuerySvc)
	userHandler.RegisterUserRoutes(r)

	// 系统监控：在线用户
	onlineUserHandler := httpif.NewOnlineUserHandler(d.onlineStore)
	onlineUserHandler.RegisterOnlineUserRoutes(r)

	// 系统管理：菜单管理
	menuHandler := httpif.NewMenuHandler(d.menuSvc)
	menuHandler.RegisterMenuRoutes(r)

	// 系统管理：角色管理
	roleHandler := httpif.NewRoleHandler(d.roleSvc)
	roleHandler.RegisterRoleRoutes(r)

	// 系统管理：部门管理（仅树查询）
	deptHandler := httpif.NewDeptHandler(d.systemSvc)
	deptHandler.RegisterDeptRoutes(r)

	// 系统管理：用户管理
	systemUserHandler := httpif.NewSystemUserHandler(d.userAdminSvc)
	systemUserHandler.RegisterSystemUserRoutes(r)

	// 系统管理：字典管理
	dictHandler := httpif.NewDictHandler(d.dictSvc)
	dictHandler.RegisterDictRoutes(r)

	// 系统管理：系统配置（参数管理）
	optionHandler := httpif.NewOptionHandler(d.systemSvc)
	optionHandler.RegisterOptionRoutes(r)

	// 系统管理：文件管理
	fileHandler := httpif.NewFileHandler(d.fileSvc)
	fileHandler.RegisterFileRoutes(r)

	// 系统管理：存储配置
	storageHandler := httpif.NewStorageHandler(d.storageSvc)
	storageHandler.RegisterStorageRoutes(r)

	// 系统管理：客户端配置
	clientHandler := httpif.NewClientHandler(d.clientSvc)
	clientHandler.RegisterClientRoutes(r)

	// 系统监控：系统日志
	logHandler := httpif.NewLogHandler(d.sysLogSvc)
	logHandler.RegisterLogRoutes(r)

	// 静态文件访问（上传文件）
	fileRoot := d.fileRoot
	if fileRoot == "" {
		fileRoot = "./data/file"
	}
	r.Static("/file", fileRoot)
}

func setupCORS(r *gin.Engine) {
	if r == nil {
		return
	}
	// 全局 CORS（开发阶段允许前端本地调试）
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		// 只在本地开发时放开 localhost:3000，如需更多域名可按需扩展
		if origin == "http://localhost:14399" {
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
}
