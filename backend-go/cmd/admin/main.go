package main

import (
	"log"

	"go-backend/internal/bootstrap"
	"go-backend/internal/config"
)

// @title go-backend 接口文档
// @version 1.0
// @description Avalon 平台 Go 后端接口文档，涵盖认证、系统管理、日志等模块。
// @BasePath /
// @schemes http
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config failed: %v", err)
	}

	r, closeFn, err := bootstrap.BuildAdminApp(cfg)
	if err != nil {
		log.Fatalf("build app failed: %v", err)
	}
	if closeFn != nil {
		defer closeFn()
	}

	// 启动 HTTP 服务
	if err := r.Run(":" + cfg.HTTPPort); err != nil {
		log.Fatalf("failed to start http server: %v", err)
	}
}
