package main

import (
	"context"
	"fmt"
	"os"

	"voc-go-backend/internal/infrastructure/db"
	rbacp "voc-go-backend/internal/infrastructure/persistence/rbac"
)

func main() {
	cfg := db.LoadConfigFromEnv()
	pg, err := db.NewPostgres(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect db failed: %v\n", err)
		os.Exit(1)
	}
	defer pg.Close()

	repo := rbacp.NewPgMenuRepository(pg)
	menus, err := repo.ListByRoleID(context.Background(), 1)
	if err != nil {
		fmt.Fprintf(os.Stderr, "list menus failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("menus: %+v\n", menus)
}
