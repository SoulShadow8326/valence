package lip

import (
	"crypto/ed25519"

	"valence/protocol/atom"
)

func Crystallize(kind atom.Kind, tags []string, payload map[string]string, refs []atom.AtomID, seq uint64, priv ed25519.PrivateKey, pub ed25519.PublicKey) (atom.Atom, error) {
	return atom.New(kind, tags, payload, refs, seq, priv, pub)
}
