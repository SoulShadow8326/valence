package atom

import (
	"crypto/ed25519"
	"strings"
	"testing"
)

func testKeypair(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	return pub, priv
}

func mustAtom(t *testing.T) Atom {
	t.Helper()
	pub, priv := testKeypair(t)
	a, err := New(KindNeed, []string{"Water", " water ", "Sector7"}, map[string]string{
		"resource": "water", "quantity": "200",
	}, nil, 0, priv, pub)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func TestRoundTrip(t *testing.T) {
	a := mustAtom(t)
	b, err := Unmarshal(Marshal(a))
	if err != nil {
		t.Fatal(err)
	}
	if ID(a) != ID(b) {
		t.Fatalf("round-trip changed ID: %s != %s", ID(a), ID(b))
	}
	if err := Verify(b); err != nil {
		t.Fatalf("round-tripped atom fails verify: %v", err)
	}
}

func TestTagDedupeAndSort(t *testing.T) {
	a := mustAtom(t)
	want := []string{"sector7", "water"}
	if !stringsEqual(a.Tags, want) {
		t.Fatalf("got tags %v, want %v", a.Tags, want)
	}
}

func TestTamperDetection(t *testing.T) {
	a := mustAtom(t)
	orig := Marshal(a)

	for i := range orig {
		tampered := append([]byte{}, orig...)
		tampered[i] ^= 0xFF
		b, err := Unmarshal(tampered)
		if err != nil {
			continue
		}
		if ID(b) == ID(a) && VerifySig(b) {
			t.Fatalf("bit flip at byte %d silently accepted", i)
		}
	}
}

func TestNonNormalizedTagsRejected(t *testing.T) {
	pub, priv := testKeypair(t)
	a := Atom{
		Kind:    KindNeed,
		Tags:    []string{"Water"},
		Payload: map[string]string{"resource": "water", "quantity": "1"},
		Clock:   Clock{Pub: pub, Seq: 0},
		PubKey:  pub,
	}
	a.Sig = Sign(priv, a)
	if err := Validate(a); err == nil {
		t.Fatal("expected rejection of non-normalized tags")
	}
}

func TestLimits(t *testing.T) {
	pub, priv := testKeypair(t)

	build := func(nTags int) Atom {
		tags := make([]string, nTags)
		for i := range tags {
			tags[i] = padTag(i)
		}
		a := Atom{
			Kind:    KindNeed,
			Tags:    NormalizeTags(tags),
			Payload: map[string]string{"resource": "water", "quantity": "1"},
			Clock:   Clock{Pub: pub, Seq: 0},
			PubKey:  pub,
		}
		a.Sig = Sign(priv, a)
		return a
	}

	ok := build(MaxTags)
	if err := Validate(ok); err != nil {
		t.Fatalf("at-limit tags rejected: %v", err)
	}

	over := build(MaxTags + 1)
	if err := Validate(over); err == nil {
		t.Fatal("over-limit tags accepted")
	}
}

func padTag(i int) string {
	return "tag" + strings.Repeat("z", 0) + itoa(i)
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	digits := ""
	for i > 0 {
		digits = string(rune('0'+i%10)) + digits
		i /= 10
	}
	return digits
}

func TestMissingRequiredPayloadKey(t *testing.T) {
	pub, priv := testKeypair(t)
	a := Atom{
		Kind:    KindNeed,
		Tags:    nil,
		Payload: map[string]string{"resource": "water"},
		Clock:   Clock{Pub: pub, Seq: 0},
		PubKey:  pub,
	}
	a.Sig = Sign(priv, a)
	if err := Validate(a); err == nil {
		t.Fatal("expected rejection of missing required payload key")
	}
}

func TestSelfCorroborationIsSameAtom(t *testing.T) {
	pub, priv := testKeypair(t)
	a1, _ := New(KindObservation, []string{"road"}, map[string]string{"subject": "x", "state": "clear"}, nil, 0, priv, pub)
	a2, _ := New(KindObservation, []string{"road"}, map[string]string{"subject": "x", "state": "clear"}, nil, 0, priv, pub)
	if ID(a1) != ID(a2) {
		t.Fatal("identical content + same publisher + same seq should be the same atom")
	}
}
