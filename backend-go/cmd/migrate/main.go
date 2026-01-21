package main

// migrate 命令用于显式执行数据库初始化/迁移，避免生产启动时隐式执行 DDL。

import (
	"fmt"
	"os"

	"go-backend/internal/config"
	"go-backend/internal/infrastructure/db"
)

func main() {
	dbCfg := config.LoadDatabaseConfig()
	pg, err := db.NewPostgres(dbCfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect postgres failed: %v\n", err)
		os.Exit(1)
	}
	defer pg.Close()

	if err := db.AutoMigrate(pg); err != nil {
		fmt.Fprintf(os.Stderr, "auto-migrate failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintln(os.Stdout, "auto-migrate done")
}
