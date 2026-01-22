package main

import (
	"context"
	"fmt"
	"os"

	"go-backend/internal/infrastructure/db"
	rbacp "go-backend/internal/infrastructure/persistence/rbac"
)

func main() {
	cfg := db.LoadConfigFromEnv()
	sqlDB, err := db.Open(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect db failed: %v\n", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	repo := rbacp.NewMenuRepository(sqlDB, cfg.Dialect)
	menus, err := repo.ListByRoleID(context.Background(), 1)
	if err != nil {
		fmt.Fprintf(os.Stderr, "list menus failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("menus: %+v\n", menus)
}
