package engine

import (
	"crypto/ed25519"
	"net"
	"testing"

	"valence/node/store"
	"valence/protocol/atom"
	"valence/protocol/bond"
)

func testAtom(t *testing.T, seq uint64, tag string) atom.Atom {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	a, err := atom.New(atom.KindObservation, []string{tag}, map[string]string{"subject": tag, "state": "up"}, nil, seq, priv, pub)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func graphHashOf(st *store.Store) [32]byte {
	atoms := st.All()
	return bond.GraphHash(atoms, bond.Bonds(atoms))
}

func TestSyncRoundConverges(t *testing.T) {
	stA := store.New()
	stB := store.New()

	a1 := testAtom(t, 0, "alpha")
	a2 := testAtom(t, 1, "bravo")
	b1 := testAtom(t, 0, "charlie")

	stA.Put(a1)
	stA.Put(a2)
	stB.Put(b1)

	connA, connB := net.Pipe()

	type res struct {
		pulled, pushed int
		err            error
	}
	resA := make(chan res, 1)
	resB := make(chan res, 1)

	go func() {
		p, sh, err := runInitiator(connA, stA)
		resA <- res{p, sh, err}
	}()
	go func() {
		p, sh, err := runResponder(connB, stB)
		resB <- res{p, sh, err}
	}()

	ra, rb := <-resA, <-resB
	if ra.err != nil {
		t.Fatalf("initiator: %v", ra.err)
	}
	if rb.err != nil {
		t.Fatalf("responder: %v", rb.err)
	}

	if stA.Len() != 3 || stB.Len() != 3 {
		t.Fatalf("expected both stores to hold 3 atoms, got A=%d B=%d", stA.Len(), stB.Len())
	}

	if graphHashOf(stA) != graphHashOf(stB) {
		t.Fatal("stores did not converge to the same GraphHash")
	}
}

func TestSyncRoundIdempotent(t *testing.T) {
	stA := store.New()
	stB := store.New()
	stA.Put(testAtom(t, 0, "x"))
	stB.Put(testAtom(t, 0, "y"))

	round := func() {
		connA, connB := net.Pipe()
		done := make(chan struct{}, 2)
		go func() { runInitiator(connA, stA); done <- struct{}{} }()
		go func() { runResponder(connB, stB); done <- struct{}{} }()
		<-done
		<-done
	}

	round()
	firstLenA, firstLenB := stA.Len(), stB.Len()

	round()
	if stA.Len() != firstLenA || stB.Len() != firstLenB {
		t.Fatalf("second round changed set sizes: A %d->%d B %d->%d", firstLenA, stA.Len(), firstLenB, stB.Len())
	}
}
