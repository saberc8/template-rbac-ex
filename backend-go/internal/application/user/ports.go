package user

// PasswordHasher hashes a raw password into a stored representation.
type PasswordHasher interface {
	Hash(raw string) (string, error)
}
