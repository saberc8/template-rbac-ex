package sqlutil

// 包 sqlutil 定义 DB/TX 通用查询接口，并提供基于 context 的事务传递工具。

import (
	"context"
	"database/sql"
)

// Querier 抽象 *sql.DB 与 *sql.Tx 的公共查询能力，便于仓储在事务内复用实现。
type Querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type ctxKeyTx struct{}

func ContextWithTx(ctx context.Context, tx *sql.Tx) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, ctxKeyTx{}, tx)
}

func TxFromContext(ctx context.Context) *sql.Tx {
	if ctx == nil {
		return nil
	}
	v := ctx.Value(ctxKeyTx{})
	tx, _ := v.(*sql.Tx)
	return tx
}

func QuerierFromContext(ctx context.Context, db *sql.DB) Querier {
	if tx := TxFromContext(ctx); tx != nil {
		return tx
	}
	return db
}
