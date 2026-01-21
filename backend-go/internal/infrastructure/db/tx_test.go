package db

import (
	"context"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	"go-backend/internal/infrastructure/persistence/sqlutil"
)

func TestTxManager_Commit(t *testing.T) {
	database, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer database.Close()

	mock.ExpectBegin()
	mock.ExpectCommit()

	m := NewTxManager(database)
	if err := m.WithinTx(context.Background(), func(ctx context.Context) error {
		if sqlutil.TxFromContext(ctx) == nil {
			t.Fatalf("expected tx in context")
		}
		return nil
	}); err != nil {
		t.Fatalf("WithinTx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestTxManager_RollbackOnError(t *testing.T) {
	database, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer database.Close()

	mock.ExpectBegin()
	mock.ExpectRollback()

	m := NewTxManager(database)
	want := errors.New("boom")
	if err := m.WithinTx(context.Background(), func(ctx context.Context) error {
		return want
	}); !errors.Is(err, want) {
		t.Fatalf("expected error %v, got %v", want, err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestTxManager_NestedReusesTx(t *testing.T) {
	database, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer database.Close()

	mock.ExpectBegin()
	mock.ExpectCommit()

	m := NewTxManager(database)
	if err := m.WithinTx(context.Background(), func(ctx context.Context) error {
		if sqlutil.TxFromContext(ctx) == nil {
			t.Fatalf("expected outer tx in context")
		}
		return m.WithinTx(ctx, func(inner context.Context) error {
			if sqlutil.TxFromContext(inner) == nil {
				t.Fatalf("expected inner tx in context")
			}
			return nil
		})
	}); err != nil {
		t.Fatalf("WithinTx: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
