package atom

import "crypto/sha256"


func ID(a Atom) AtomID {
	return sha256.Sum256(Canonical(a))
}

