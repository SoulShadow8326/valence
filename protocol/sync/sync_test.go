package sync

import (
	"crypto/ed25519"
	"testing"

	"valence/protocol/atom"
)

func testAtom(t *testing.T, seq uint64) atom.Atom {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	a, err := atom.New(atom.KindObservation, []string{"x"}, map[string]string{"subject": "s", "state": "up"}, nil, seq, priv, pub)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func idsOf(atoms []atom.Atom) []atom.AtomID {
	ids := make([]atom.AtomID, len(atoms))
	for i, a := range atoms {
		ids[i] = atom.ID(a)
	}
	return ids
}

func containsID(ids []atom.AtomID, target atom.AtomID) bool {
	for _, id := range ids {
		if id == target {
			return true
		}
	}
	return false
}

func simulateRound(a, b []atom.AtomID) (aWants, bWants []atom.AtomID) {
	digestA := BuildDigest(a)
	digestB := BuildDigest(b)
	mismatched := MismatchedBuckets(digestA, digestB)

	aIDs := BucketIDs(a, mismatched)
	bIDs := BucketIDs(b, mismatched)

	aWants = Missing(aIDs, bIDs)
	bWants = Missing(bIDs, aIDs)
	return
}

func TestDisjointSetsConverge(t *testing.T) {
	a1, a2, a3 := testAtom(t, 0), testAtom(t, 1), testAtom(t, 2)
	nodeA := idsOf([]atom.Atom{a1, a2})
	nodeB := idsOf([]atom.Atom{a3})

	aWants, bWants := simulateRound(nodeA, nodeB)
	if len(aWants) != 1 || !containsID(aWants, atom.ID(a3)) {
		t.Fatalf("A should want exactly a3, got %v", aWants)
	}
	if len(bWants) != 2 || !containsID(bWants, atom.ID(a1)) || !containsID(bWants, atom.ID(a2)) {
		t.Fatalf("B should want exactly a1,a2, got %v", bWants)
	}
}

func TestIdenticalSetsNoMismatch(t *testing.T) {
	a1, a2 := testAtom(t, 0), testAtom(t, 1)
	ids := idsOf([]atom.Atom{a1, a2})
	d1 := BuildDigest(ids)
	d2 := BuildDigest(ids)
	if len(MismatchedBuckets(d1, d2)) != 0 {
		t.Fatal("identical sets should have zero mismatched buckets")
	}
	aWants, bWants := simulateRound(ids, ids)
	if len(aWants) != 0 || len(bWants) != 0 {
		t.Fatalf("identical sets should transfer nothing, got aWants=%v bWants=%v", aWants, bWants)
	}
}

func TestSecondRoundTransfersNothing(t *testing.T) {
	a1, a2, a3 := testAtom(t, 0), testAtom(t, 1), testAtom(t, 2)
	nodeA := idsOf([]atom.Atom{a1, a2})
	nodeB := idsOf([]atom.Atom{a3})

	aWants, bWants := simulateRound(nodeA, nodeB)
	mergedA := append(append([]atom.AtomID{}, nodeA...), aWants...)
	mergedB := append(append([]atom.AtomID{}, nodeB...), bWants...)

	aWants2, bWants2 := simulateRound(mergedA, mergedB)
	if len(aWants2) != 0 || len(bWants2) != 0 {
		t.Fatalf("second round should transfer nothing, got aWants=%v bWants=%v", aWants2, bWants2)
	}
}

func TestMalformedLengthRejectedWithoutAllocating(t *testing.T) {

	b := []byte{TagAtoms, 0xFF, 0xFF, 0xFF, 0xFF}
	if _, err := DecodeAtoms(b); err == nil {
		t.Fatal("expected rejection of oversized atom count")
	}

	b2 := []byte{TagAtoms, 1, 0, 0, 0, 0xFF, 0xFF, 0xFF, 0xFF}
	if _, err := DecodeAtoms(b2); err == nil {
		t.Fatal("expected rejection of oversized atom body length")
	}
}

func TestWireRoundTrip(t *testing.T) {
	a1, a2 := testAtom(t, 0), testAtom(t, 1)
	ids := idsOf([]atom.Atom{a1, a2})

	d := BuildDigest(ids)
	d2, err := DecodeDigest(EncodeDigest(d))
	if err != nil || d2 != d {
		t.Fatalf("digest round-trip failed: %v", err)
	}

	ids2, err := DecodeIDs(EncodeIDs(ids))
	if err != nil || len(ids2) != len(ids) {
		t.Fatalf("ids round-trip failed: %v", err)
	}

	atoms2, err := DecodeAtoms(EncodeAtoms([]atom.Atom{a1, a2}))
	if err != nil || len(atoms2) != 2 {
		t.Fatalf("atoms round-trip failed: %v", err)
	}
	if atom.ID(atoms2[0]) != atom.ID(a1) {
		t.Fatal("atoms round-trip changed content")
	}
}
