package security

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"
)

func TestRSADecryptor_Base64_PKCS8_And_PKCS1(t *testing.T) {
	t.Parallel()

	key, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}

	plaintext := []byte("p@ssw0rd!")
	cipher, err := rsa.EncryptPKCS1v15(rand.Reader, &key.PublicKey, plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	cipherB64 := base64.StdEncoding.EncodeToString(cipher)

	t.Run("pkcs8-der-base64", func(t *testing.T) {
		t.Parallel()

		der, err := x509.MarshalPKCS8PrivateKey(key)
		if err != nil {
			t.Fatalf("marshal pkcs8: %v", err)
		}
		d, err := NewRSADecryptorFromBase64(base64.StdEncoding.EncodeToString(der))
		if err != nil {
			t.Fatalf("new decryptor: %v", err)
		}
		got, err := d.DecryptBase64(cipherB64)
		if err != nil {
			t.Fatalf("decrypt: %v", err)
		}
		if got != string(plaintext) {
			t.Fatalf("unexpected plaintext: %q", got)
		}
	})

	t.Run("pkcs1-der-base64", func(t *testing.T) {
		t.Parallel()

		der := x509.MarshalPKCS1PrivateKey(key)
		d, err := NewRSADecryptorFromBase64(base64.StdEncoding.EncodeToString(der))
		if err != nil {
			t.Fatalf("new decryptor: %v", err)
		}
		got, err := d.DecryptBase64(cipherB64)
		if err != nil {
			t.Fatalf("decrypt: %v", err)
		}
		if got != string(plaintext) {
			t.Fatalf("unexpected plaintext: %q", got)
		}
	})
}

func TestRSADecryptor_PEMFile_PKCS8_And_PKCS1(t *testing.T) {
	t.Parallel()

	key, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}

	plaintext := []byte("p@ssw0rd!")
	cipher, err := rsa.EncryptPKCS1v15(rand.Reader, &key.PublicKey, plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	cipherB64 := base64.StdEncoding.EncodeToString(cipher)

	tmpDir := t.TempDir()

	t.Run("pkcs8-pem", func(t *testing.T) {
		t.Parallel()

		der, err := x509.MarshalPKCS8PrivateKey(key)
		if err != nil {
			t.Fatalf("marshal pkcs8: %v", err)
		}
		pemBytes := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
		p := filepath.Join(tmpDir, "key_pkcs8.pem")
		if err := os.WriteFile(p, pemBytes, 0o600); err != nil {
			t.Fatalf("write pem: %v", err)
		}

		d, err := NewRSADecryptorFromPEMFile(p)
		if err != nil {
			t.Fatalf("new decryptor: %v", err)
		}
		got, err := d.DecryptBase64(cipherB64)
		if err != nil {
			t.Fatalf("decrypt: %v", err)
		}
		if got != string(plaintext) {
			t.Fatalf("unexpected plaintext: %q", got)
		}
	})

	t.Run("pkcs1-pem", func(t *testing.T) {
		t.Parallel()

		der := x509.MarshalPKCS1PrivateKey(key)
		pemBytes := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: der})
		p := filepath.Join(tmpDir, "key_pkcs1.pem")
		if err := os.WriteFile(p, pemBytes, 0o600); err != nil {
			t.Fatalf("write pem: %v", err)
		}

		d, err := NewRSADecryptorFromPEMFile(p)
		if err != nil {
			t.Fatalf("new decryptor: %v", err)
		}
		got, err := d.DecryptBase64(cipherB64)
		if err != nil {
			t.Fatalf("decrypt: %v", err)
		}
		if got != string(plaintext) {
			t.Fatalf("unexpected plaintext: %q", got)
		}
	})
}
