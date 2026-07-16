package atom

import (
	"crypto/ed25519"
	"fmt"
)




func Validate(a Atom) error {
	if !validKinds[a.Kind] {
		return fmt.Errorf("atom: unknown kind %q", a.Kind)
	}

	if len(a.Tags) > MaxTags {
		return fmt.Errorf("atom: %d tags exceeds max %d", len(a.Tags), MaxTags)
	}
	for _, t := range a.Tags {
		if len(t) > MaxTagBytes {
			return fmt.Errorf("atom: tag %q exceeds max %d bytes", t, MaxTagBytes)
		}
	}
	if !stringsEqual(a.Tags, NormalizeTags(a.Tags)) {
		return fmt.Errorf("atom: tags are not normalized (RFC-0001 §2.4)")
	}

	if len(a.Payload) > MaxPayloadKeys {
		return fmt.Errorf("atom: %d payload keys exceeds max %d", len(a.Payload), MaxPayloadKeys)
	}
	for k, v := range a.Payload {
		if len(k) > MaxPayloadKeyBytes {
			return fmt.Errorf("atom: payload key %q exceeds max %d bytes", k, MaxPayloadKeyBytes)
		}
		if len(v) > MaxPayloadValueBytes {
			return fmt.Errorf("atom: payload value for %q exceeds max %d bytes", k, MaxPayloadValueBytes)
		}
	}
	for _, k := range requiredPayloadKeys[a.Kind] {
		if _, ok := a.Payload[k]; !ok {
			return fmt.Errorf("atom: kind %s missing required payload key %q", a.Kind, k)
		}
	}

	if len(a.Refs) > MaxRefs {
		return fmt.Errorf("atom: %d refs exceeds max %d", len(a.Refs), MaxRefs)
	}
	if !refsEqual(a.Refs, NormalizeRefs(a.Refs)) {
		return fmt.Errorf("atom: refs are not normalized (sorted+deduped)")
	}

	if len(a.Clock.Pub) != ed25519.PublicKeySize {
		return fmt.Errorf("atom: clock.pub must be %d bytes, got %d", ed25519.PublicKeySize, len(a.Clock.Pub))
	}
	if len(a.PubKey) != ed25519.PublicKeySize {
		return fmt.Errorf("atom: pubkey must be %d bytes, got %d", ed25519.PublicKeySize, len(a.PubKey))
	}
	if !bytesEqual(a.Clock.Pub, a.PubKey) {
		return fmt.Errorf("atom: clock.pub must equal pubkey")
	}

	if len(Canonical(a)) > MaxEncodedBytes {
		return fmt.Errorf("atom: encoded size exceeds max %d bytes", MaxEncodedBytes)
	}

	return nil
}



func Verify(a Atom) error {
	if err := Validate(a); err != nil {
		return err
	}
	if !VerifySig(a) {
		return fmt.Errorf("atom: signature invalid")
	}
	return nil
}

func stringsEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func refsEqual(a, b []AtomID) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
