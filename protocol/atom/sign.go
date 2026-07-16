package atom

import "crypto/ed25519"




func Sign(priv ed25519.PrivateKey, a Atom) []byte {
	id := ID(a)
	return ed25519.Sign(priv, id[:])
}


func VerifySig(a Atom) bool {
	if len(a.PubKey) != ed25519.PublicKeySize {
		return false
	}
	id := ID(a)
	return ed25519.Verify(a.PubKey, id[:], a.Sig)
}

