package policy

import (
	"crypto/ed25519"
	"testing"
	"time"

	"valence/node/store"
	"valence/protocol/atom"
	"valence/protocol/bond"
)

func kp(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	return pub, priv
}







func TestOppositeTrustModelsStillConverge(t *testing.T) {
	pubA, privA := kp(t)
	pubB, privB := kp(t)
	pubC, privC := kp(t)

	a1, _ := atom.New(atom.KindNeed, []string{"water", "sector7"}, map[string]string{"resource": "water", "quantity": "1"}, nil, 0, privA, pubA)
	a2, _ := atom.New(atom.KindCapacity, []string{"water", "sector7"}, map[string]string{"resource": "water", "quantity": "1"}, nil, 0, privB, pubB)
	a3, _ := atom.New(atom.KindObservation, []string{"x"}, map[string]string{"subject": "s", "state": "up"}, nil, 0, privC, pubC)
	atoms := []atom.Atom{a1, a2, a3}

	stX := store.New()
	stY := store.New()
	for _, a := range atoms {
		stX.Put(a)
		stY.Put(a)
	}

	trustX := NewTrust()
	trustX.Set(pubA, 0.99)
	trustX.Set(pubB, 0.01)
	trustX.Set(pubC, 0.5)

	trustY := NewTrust()
	trustY.Set(pubA, 0.01)
	trustY.Set(pubB, 0.99)
	trustY.Set(pubC, 0.5)

	if trustX.Score(pubA) == trustY.Score(pubA) {
		t.Fatal("test setup: trust models should actually differ")
	}

	gx := bond.GraphHash(stX.All(), bond.Bonds(stX.All()))
	gy := bond.GraphHash(stY.All(), bond.Bonds(stY.All()))
	if gx != gy {
		t.Fatalf("opposite trust models produced different graphs: %x vs %x", gx, gy)
	}



	exA := Entropy(a1, mustFirstSeen(t, stX, a1), bond.Bonds(stX.All()), trustX)
	eyA := Entropy(a1, mustFirstSeen(t, stY, a1), bond.Bonds(stY.All()), trustY)
	if exA == eyA {
		t.Fatal("expected entropy to diverge under opposite trust models")
	}
}

func mustFirstSeen(t *testing.T, st *store.Store, a atom.Atom) time.Time {
	t.Helper()
	fs, ok := st.FirstSeen(atom.ID(a))
	if !ok {
		t.Fatal("atom not in store")
	}
	return fs
}

func TestSweepDropsHighEntropyKeepsLow(t *testing.T) {
	st := store.New()
	pub, priv := kp(t)
	a, err := atom.New(atom.KindObservation, []string{"x"}, map[string]string{"subject": "s", "state": "up"}, nil, 0, priv, pub)
	if err != nil {
		t.Fatal(err)
	}
	st.Put(a)

	trust := NewTrust()
	trust.Set(pub, 1.0)



	if dropped := Sweep(st, trust, GCThreshold); dropped != 0 {
		t.Fatalf("expected fresh trusted atom to survive sweep, dropped=%d", dropped)
	}
	if st.Len() != 1 {
		t.Fatal("atom should still be in store")
	}


	dropped := Sweep(st, trust, 0)
	if dropped != 1 || st.Len() != 0 {
		t.Fatalf("expected sweep(threshold=0) to drop everything, dropped=%d len=%d", dropped, st.Len())
	}
}

func TestSweepIsIdempotentAfterDrop(t *testing.T) {
	st := store.New()
	pub, priv := kp(t)
	a, _ := atom.New(atom.KindObservation, []string{"x"}, map[string]string{"subject": "s", "state": "up"}, nil, 0, priv, pub)
	st.Put(a)
	trust := NewTrust()

	Sweep(st, trust, 0)
	if st.Len() != 0 {
		t.Fatal("expected atom dropped")
	}


	st.Put(a)
	fs, ok := st.FirstSeen(atom.ID(a))
	if !ok || time.Since(fs) > time.Second {
		t.Fatal("expected a fresh firstSeen after re-insertion")
	}
}
