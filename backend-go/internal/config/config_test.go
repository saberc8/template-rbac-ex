package config

import "testing"

func TestLoad_RequiresJWTSecret(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("AUTH_JWT_SECRET", "")

	_, err := Load()
	if err == nil {
		t.Fatalf("expected error when AUTH_JWT_SECRET is missing")
	}
}

func TestLoad_Defaults(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("AUTH_JWT_SECRET", "test")
	t.Setenv("HTTP_PORT", "")
	t.Setenv("DB_AUTO_MIGRATE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HTTPPort != "14398" {
		t.Fatalf("expected default HTTPPort=14398, got %q", cfg.HTTPPort)
	}
	if !cfg.AutoMigrate {
		t.Fatalf("expected AutoMigrate=true by default in dev")
	}
}

func TestLoad_ProductionDisablesAutoMigrateByDefault(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("AUTH_JWT_SECRET", "test")
	t.Setenv("DB_AUTO_MIGRATE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.AutoMigrate {
		t.Fatalf("expected AutoMigrate=false by default in production")
	}
}

func TestLoad_ProductionCanEnableAutoMigrate(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("AUTH_JWT_SECRET", "test")
	t.Setenv("DB_AUTO_MIGRATE", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !cfg.AutoMigrate {
		t.Fatalf("expected AutoMigrate=true when DB_AUTO_MIGRATE=true")
	}
}
