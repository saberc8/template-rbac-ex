package auth

// PasswordVerifier validates a raw password against a stored hash.
type PasswordVerifier interface {
	Verify(raw, encoded string) (bool, error)
}

// TokenGenerator issues an authentication token for a given user.
type TokenGenerator interface {
	Generate(userID int64) (string, error)
}
