package sqlutil

import (
	"strings"

	"github.com/jmoiron/sqlx"
)

func normalizeDialect(dialect string) string {
	v := strings.ToLower(strings.TrimSpace(dialect))
	switch v {
	case "", "postgres", "postgresql", "pgsql":
		return "postgres"
	case "mysql":
		return "mysql"
	default:
		return v
	}
}

func Rebind(dialect string, query string) string {
	bindType := sqlx.BindType(normalizeDialect(dialect))
	if bindType == sqlx.UNKNOWN {
		return query
	}
	return sqlx.Rebind(bindType, query)
}

func In(dialect string, query string, args ...any) (string, []any, error) {
	q, outArgs, err := sqlx.In(query, args...)
	if err != nil {
		return "", nil, err
	}
	return Rebind(dialect, q), outArgs, nil
}

