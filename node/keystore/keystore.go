package keystore

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type KeyPair struct {
	Pub  ed25519.PublicKey
	Priv ed25519.PrivateKey
}





func LoadOrCreate(path string) (KeyPair, error) {
	b, err := os.ReadFile(path)
	if err == nil {
		priv, perr := parsePrivHex(string(b))
		if perr != nil {
			return KeyPair{}, fmt.Errorf("keystore: %w", perr)
		}
		return KeyPair{Pub: priv.Public().(ed25519.PublicKey), Priv: priv}, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return KeyPair{}, err
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return KeyPair{}, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return KeyPair{}, err
	}
	if err := os.WriteFile(path, []byte(hex.EncodeToString(priv)), 0600); err != nil {
		return KeyPair{}, err
	}
	return KeyPair{Pub: pub, Priv: priv}, nil
}

func parsePrivHex(s string) (ed25519.PrivateKey, error) {
	b, err := hex.DecodeString(strings.TrimSpace(s))
	if err != nil {
		return nil, err
	}
	if len(b) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("bad key size %d, want %d", len(b), ed25519.PrivateKeySize)
	}
	return ed25519.PrivateKey(b), nil
}
