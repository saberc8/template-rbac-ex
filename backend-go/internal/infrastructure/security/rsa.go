package security

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"os"
)

// RSADecryptor holds a parsed RSA private key and can decrypt
// Base64-encoded ciphertexts produced by the front-end.
type RSADecryptor struct {
	priv *rsa.PrivateKey
}

// NewRSADecryptorFromBase64 creates a decryptor from a Base64-encoded
// private key, compatible with the Java SecureUtils configuration.
//
// It accepts:
// - PKCS#8 DER (recommended)
// - PKCS#1 DER (legacy)
func NewRSADecryptorFromBase64(b64Key string) (*RSADecryptor, error) {
	if b64Key == "" {
		return nil, errors.New("rsa private key is empty")
	}
	der, err := base64.StdEncoding.DecodeString(b64Key)
	if err != nil {
		return nil, fmt.Errorf("decode private key: %w", err)
	}

	if k, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		priv, ok := k.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("unexpected private key type %T", k)
		}
		return &RSADecryptor{priv: priv}, nil
	}

	// Fallback for legacy PKCS#1 DER.
	if priv, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return &RSADecryptor{priv: priv}, nil
	} else {
		return nil, fmt.Errorf("parse rsa private key: %w", err)
	}
}

// NewRSADecryptorFromPEMFile creates a decryptor from a PEM encoded RSA private key file.
//
// It supports:
// - PKCS#8 PEM (-----BEGIN PRIVATE KEY-----)
// - PKCS#1 PEM (-----BEGIN RSA PRIVATE KEY-----)
func NewRSADecryptorFromPEMFile(pemPath string) (*RSADecryptor, error) {
	if pemPath == "" {
		return nil, errors.New("pem path is empty")
	}
	raw, err := os.ReadFile(pemPath)
	if err != nil {
		return nil, fmt.Errorf("read pem file: %w", err)
	}
	block, _ := pem.Decode(raw)
	if block == nil {
		return nil, errors.New("decode pem: no pem block found")
	}

	switch block.Type {
	case "PRIVATE KEY":
		if k, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
			priv, ok := k.(*rsa.PrivateKey)
			if !ok {
				return nil, fmt.Errorf("unexpected private key type %T", k)
			}
			return &RSADecryptor{priv: priv}, nil
		}
		// Some tools may still produce PKCS#1 in a generic PRIVATE KEY block; fall back.
		if priv, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
			return &RSADecryptor{priv: priv}, nil
		}
		return nil, errors.New("parse private key from pem: unsupported format")
	case "RSA PRIVATE KEY":
		priv, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("parse pkcs1 private key: %w", err)
		}
		return &RSADecryptor{priv: priv}, nil
	default:
		return nil, fmt.Errorf("unsupported pem block type: %s", block.Type)
	}
}

// DecryptBase64 decrypts a Base64-encoded ciphertext using RSA/PKCS1v15.
// It returns the UTF-8 plaintext password.
func (d *RSADecryptor) DecryptBase64(cipherB64 string) (string, error) {
	if d == nil || d.priv == nil {
		return "", errors.New("rsa decryptor not initialized")
	}
	cipherBytes, err := base64.StdEncoding.DecodeString(cipherB64)
	if err != nil {
		return "", fmt.Errorf("decode cipher text: %w", err)
	}
	plain, err := decryptPKCS1v15Insecure(d.priv, cipherBytes)
	if err != nil {
		return "", fmt.Errorf("rsa decrypt: %w", err)
	}
	return string(plain), nil
}

// decryptPKCS1v15Insecure is a minimal PKCS#1 v1.5 RSA decryption implementation
// that intentionally allows 512-bit keys (Go's crypto/rsa blocks them by default).
// This is only for compatibility with the existing Java/Hutool configuration.
func decryptPKCS1v15Insecure(priv *rsa.PrivateKey, ciphertext []byte) ([]byte, error) {
	k := (priv.N.BitLen() + 7) / 8
	if len(ciphertext) != k {
		return nil, errors.New("rsa: incorrect ciphertext length")
	}

	c := new(big.Int).SetBytes(ciphertext)
	if c.Cmp(priv.N) > 0 {
		return nil, errors.New("rsa: decryption error")
	}

	m := new(big.Int).Exp(c, priv.D, priv.N)
	em := m.Bytes()
	if len(em) < k {
		em = append(make([]byte, k-len(em)), em...)
	}
	// Expect 0x00 || 0x02 || PS || 0x00 || M
	if k < 11 {
		return nil, errors.New("rsa: decryption error")
	}
	if em[0] != 0x00 || em[1] != 0x02 {
		return nil, errors.New("rsa: decryption error")
	}
	// Find 0x00 separator; PS must be at least 8 bytes.
	sep := -1
	for i := 2; i < len(em); i++ {
		if em[i] == 0x00 {
			sep = i
			break
		}
	}
	if sep < 10 {
		return nil, errors.New("rsa: decryption error")
	}
	return em[sep+1:], nil
}
