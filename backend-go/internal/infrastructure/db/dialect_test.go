package db

import "testing"

func TestNormalizeDialect_MariaDBIsAliasForMySQL(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"mariadb", DialectMySQL},
		{"MariaDB", DialectMySQL},
		{" mysql ", DialectMySQL},
		{"postgresql", DialectPostgres},
		{"", DialectPostgres},
	}

	for _, tc := range cases {
		if got := NormalizeDialect(tc.in); got != tc.want {
			t.Fatalf("NormalizeDialect(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestLoadConfigFromEnv_DefaultsMatchMariaDB(t *testing.T) {
	t.Setenv("DB_DIALECT", "mariadb")
	t.Setenv("DB_HOST", "")
	t.Setenv("DB_PORT", "")
	t.Setenv("DB_USER", "")
	t.Setenv("DB_PWD", "")
	t.Setenv("DB_NAME", "")

	cfg := LoadConfigFromEnv()
	if cfg.Dialect != DialectMySQL {
		t.Fatalf("expected dialect=%q, got %q", DialectMySQL, cfg.Dialect)
	}
	if cfg.Port != "3306" {
		t.Fatalf("expected default port=3306, got %q", cfg.Port)
	}
	if cfg.User != "root" {
		t.Fatalf("expected default user=root, got %q", cfg.User)
	}
}
