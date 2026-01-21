package client

import "context"

type PageQuery struct {
	Page       int
	Size       int
	ClientType string
	AuthType   []string
	Status     *int16
}

type PageResult struct {
	List  []ClientDetail
	Total int64
}

// Repository 定义客户端配置的持久化接口。
type Repository interface {
	Page(ctx context.Context, q PageQuery) (PageResult, error)
	Get(ctx context.Context, id int64) (*ClientDetail, error)
	Create(ctx context.Context, c *Client) error
	Update(ctx context.Context, c *Client) error
	Delete(ctx context.Context, ids []int64) error
}

