package db

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestAutoMigrateContext_BeginsTxAndRollsBackOnError(t *testing.T) {
	database, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`CREATE TABLE IF NOT EXISTS sys_user`)).
		WillReturnError(errors.New("boom"))
	mock.ExpectRollback()

	if err := AutoMigrateContext(context.Background(), database, DialectPostgres); err == nil {
		t.Fatalf("expected error, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}
