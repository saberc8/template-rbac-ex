package auth

import "context"

// PasswordVerifier validates a raw password against a stored hash.
type PasswordVerifier interface {
	Verify(raw, encoded string) (bool, error)
}

// TokenGenerator issues an authentication token for a given user.
type TokenGenerator interface {
	Generate(userID int64) (string, error)
}

// LoginCaptchaPolicy decides whether login captcha should be checked for the given request.
type LoginCaptchaPolicy interface {
	IsEnabled(ctx context.Context) (bool, error)
}

// CaptchaVerifier validates and consumes a captcha value.
// Implementations should delete the captcha after successful verification.
type CaptchaVerifier interface {
	VerifyAndConsume(ctx context.Context, id, answer string) (bool, error)
}
