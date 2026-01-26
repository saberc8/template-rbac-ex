package db

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
)

const (
	DialectPostgres = "postgres"
	DialectMySQL    = "mysql"
)

// Config holds SQL database connection configuration.
type Config struct {
	Dialect  string
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// LoadConfigFromEnv builds a Config from environment variables with
// reasonable defaults matching the existing Java project.
func LoadConfigFromEnv() Config {
	dialect := NormalizeDialect(getenvDefault("DB_DIALECT", DialectPostgres))
	defaultPort := "5432"
	defaultUser := "postgres"
	if dialect == DialectMySQL {
		defaultPort = "3306"
		defaultUser = "root"
	}

	return Config{
		Dialect:  dialect,
		Host:     getenvDefault("DB_HOST", "127.0.0.1"),
		Port:     getenvDefault("DB_PORT", defaultPort),
		User:     getenvDefault("DB_USER", defaultUser),
		Password: getenvDefault("DB_PWD", "123456"),
		DBName:   getenvDefault("DB_NAME", "ex_admin_v1"),
		SSLMode:  getenvDefault("DB_SSLMODE", "disable"),
	}
}

func NormalizeDialect(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	switch v {
	case "", DialectPostgres, "postgresql", "pgsql":
		return DialectPostgres
	case DialectMySQL, "mariadb":
		return DialectMySQL
	default:
		return v
	}
}

func Open(cfg Config) (*sql.DB, error) {
	dialect := NormalizeDialect(cfg.Dialect)

	var (
		driverName string
		dsn        string
	)

	switch dialect {
	case DialectPostgres:
		driverName = "postgres"
		dsn = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
		)
	case DialectMySQL:
		driverName = "mysql"
		mysqlCfg := mysqlDriver.NewConfig()
		mysqlCfg.User = cfg.User
		mysqlCfg.Passwd = cfg.Password
		mysqlCfg.Net = "tcp"
		mysqlCfg.Addr = fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
		mysqlCfg.DBName = cfg.DBName
		mysqlCfg.ParseTime = true
		mysqlCfg.Loc = time.Local
		mysqlCfg.Params = map[string]string{
			"charset":   "utf8mb4",
			"collation": "utf8mb4_unicode_ci",
		}
		dsn = mysqlCfg.FormatDSN()
	default:
		return nil, fmt.Errorf("unsupported DB_DIALECT: %s", cfg.Dialect)
	}

	database, err := sql.Open(driverName, dsn)
	if err != nil {
		return nil, err
	}

	// Basic pool tuning; adjust as needed.
	database.SetMaxOpenConns(20)
	database.SetMaxIdleConns(5)
	database.SetConnMaxLifetime(30 * time.Minute)

	if err := database.Ping(); err != nil {
		_ = database.Close()
		return nil, err
	}
	return database, nil
}

// NewPostgres opens a PostgreSQL connection using the given config.
// Deprecated: use Open with DB_DIALECT.
func NewPostgres(cfg Config) (*sql.DB, error) {
	cfg.Dialect = DialectPostgres
	return Open(cfg)
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func IsMySQLDuplicateIndexError(err error) bool {
	var mysqlErr *mysqlDriver.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Number == 1061
	}
	return false
}
