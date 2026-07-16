package atom

import (
	"bytes"
	"crypto/ed25519"
	"encoding/hex"
	"fmt"
)




type Kind string

const (
	KindNeed        Kind = "NEED"
	KindCapacity    Kind = "CAPACITY"
	KindRoute       Kind = "ROUTE"
	KindObservation Kind = "OBSERVATION"
	KindClaim       Kind = "CLAIM"
)

var validKinds = map[Kind]bool{
	KindNeed:        true,
	KindCapacity:    true,
	KindRoute:       true,
	KindObservation: true,
	KindClaim:       true,
}


var requiredPayloadKeys = map[Kind][]string{
	KindNeed:        {"resource", "quantity"},
	KindCapacity:    {"resource", "quantity"},
	KindRoute:       {"from", "to"},
	KindObservation: {"subject", "state"},
	KindClaim:       {"subject", "state"},
}


const (
	MaxTags              = 32
	MaxTagBytes          = 64
	MaxPayloadKeys       = 16
	MaxPayloadKeyBytes   = 256
	MaxPayloadValueBytes = 1024
	MaxRefs              = 16
	MaxEncodedBytes      = 8192
)


type AtomID [32]byte

func (id AtomID) String() string { return hex.EncodeToString(id[:]) }



func (id AtomID) Less(other AtomID) bool { return bytes.Compare(id[:], other[:]) < 0 }

func ParseAtomID(s string) (AtomID, error) {
	b, err := hex.DecodeString(s)
	if err != nil {
		return AtomID{}, err
	}
	if len(b) != 32 {
		return AtomID{}, fmt.Errorf("atom: id must be 32 bytes, got %d", len(b))
	}
	var id AtomID
	copy(id[:], b)
	return id, nil
}






type Clock struct {
	Pub []byte
	Seq uint64
}



type Atom struct {
	Kind    Kind
	Tags    []string
	Payload map[string]string
	Refs    []AtomID
	Clock   Clock
	PubKey  []byte
	Sig     []byte
}




func New(kind Kind, tags []string, payload map[string]string, refs []AtomID, seq uint64, priv ed25519.PrivateKey, pub ed25519.PublicKey) (Atom, error) {
	a := Atom{
		Kind:    kind,
		Tags:    NormalizeTags(tags),
		Payload: payload,
		Refs:    NormalizeRefs(refs),
		Clock:   Clock{Pub: pub, Seq: seq},
		PubKey:  pub,
	}
	if err := Validate(a); err != nil {
		return Atom{}, err
	}
	a.Sig = Sign(priv, a)
	return a, nil
}
