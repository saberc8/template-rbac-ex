package apperr

// 包 apperr 提供统一的应用错误模型，用于在 application 与 interfaces 层之间传递可控的 code/msg。

type Error struct {
	Code   string
	Msg    string
	Err    error
	Fields map[string]any
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return e.Msg
}

func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func New(code, msg string) *Error {
	return &Error{Code: code, Msg: msg}
}

func Wrap(code, msg string, err error) *Error {
	return &Error{Code: code, Msg: msg, Err: err}
}

func (e *Error) WithField(key string, value any) *Error {
	if e == nil {
		return nil
	}
	if e.Fields == nil {
		e.Fields = make(map[string]any, 1)
	}
	e.Fields[key] = value
	return e
}
