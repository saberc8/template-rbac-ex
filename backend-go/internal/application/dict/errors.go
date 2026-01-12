package dict

type Error struct {
	Code string
	Msg  string
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return e.Msg
}
