package db

// 本文件提供事务管理器，供 application 层显式声明事务边界并向下游仓储传递事务。

import (
	"context"
	"database/sql"

	"go-backend/internal/infrastructure/persistence/sqlutil"
)

type TxManager struct {
	db *sql.DB
}

func NewTxManager(db *sql.DB) *TxManager {
	return &TxManager{db: db}
}

// WithinTx 在一个事务中执行 fn：
// - 若 ctx 已包含事务（嵌套调用），则复用外层事务；
// - 若外层无事务，则创建新事务并在 fn 成功后提交，失败回滚。
func (m *TxManager) WithinTx(ctx context.Context, fn func(ctx context.Context) error) error {
	if fn == nil {
		return nil
	}
	if m == nil || m.db == nil {
		return fn(ctx)
	}
	if sqlutil.TxFromContext(ctx) != nil {
		return fn(ctx)
	}

	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		_ = tx.Rollback()
	}()

	if err := fn(sqlutil.ContextWithTx(ctx, tx)); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true
	return nil
}
