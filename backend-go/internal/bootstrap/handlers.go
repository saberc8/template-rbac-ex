package bootstrap

import (
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	appauth "go-backend/internal/application/auth"
	appclient "go-backend/internal/application/client"
	appdict "go-backend/internal/application/dict"
	apprbac "go-backend/internal/application/rbac"
	appstorage "go-backend/internal/application/storage"
	appsyslog "go-backend/internal/application/syslog"
	appsystem "go-backend/internal/application/system"
	appuser "go-backend/internal/application/user"
	"go-backend/internal/infrastructure/security"
	httpif "go-backend/internal/interfaces/http"
)

type handlerDeps struct {
	redisClient *redis.Client
	tokenSvc    *security.TokenService
	onlineStore *httpif.OnlineStore

	loginUC      *appauth.LoginUseCase
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
	authHandler := httpif.NewAuthHandler(d.loginUC, d.onlineStore)
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

