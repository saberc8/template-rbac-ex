package http

import (
	"database/sql/driver"
	"strconv"
	"strings"
)

// pqInt64Array wraps []int64 for simple ANY($1::bigint[]) usage.
// 由于部分 handler 仍在使用该写法，这里保留公共实现，避免重复定义。
type pqInt64Array []int64

func (a pqInt64Array) Value() (driver.Value, error) {
	if len(a) == 0 {
		return "{}", nil
	}
	// simple text array representation: {1,2,3}
	var sb strings.Builder
	sb.WriteByte('{')
	for i, v := range a {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(strconv.FormatInt(v, 10))
	}
	sb.WriteByte('}')
	return sb.String(), nil
}

