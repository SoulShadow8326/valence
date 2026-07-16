package bond

import (
	"crypto/ed25519"
	"math/rand"
	"testing"

	"valence/protocol/atom"
)

type kp struct {
	pub  ed25519.PublicKey
	priv ed25519.PrivateKey
}

func newKP(t *testing.T) kp {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	return kp{pub, priv}
}

func mkAtom(t *testing.T, k kp, kind atom.Kind, tags []string, payload map[string]string, refs []atom.AtomID, seq uint64) atom.Atom {
	t.Helper()
	a, err := atom.New(kind, tags, payload, refs, seq, k.priv, k.pub)
	if err != nil {
		t.Fatalf("atom.New: %v", err)
	}
	return a
}

func TestPermutationInvariance(t *testing.T) {
	a, b, c := newKP(t), newKP(t), newKP(t)
	atoms := []atom.Atom{
		mkAtom(t, a, atom.KindNeed, []string{"water", "sector7", "urgent"}, map[string]string{"resource": "water", "quantity": "200"}, nil, 0),
		mkAtom(t, b, atom.KindCapacity, []string{"water", "sector3", "surplus"}, map[string]string{"resource": "water", "quantity": "500"}, nil, 0),
	}
	a3refs := []atom.AtomID{atom.ID(atoms[0]), atom.ID(atoms[1])}
	atoms = append(atoms, mkAtom(t, c, atom.KindRoute, []string{"sector3", "sector7", "road"}, map[string]string{"from": "sector3", "to": "sector7"}, a3refs, 0))
	atoms = append(atoms, mkAtom(t, b, atom.KindCapacity, []string{"water", "sector7", "surplus", "delivery"}, map[string]string{"resource": "water", "quantity": "500"}, nil, 1))
	atoms = append(atoms, mkAtom(t, a, atom.KindObservation, []string{"sector7", "road", "water"}, map[string]string{"subject": "route", "state": "clear"}, nil, 1))
	atoms = append(atoms, mkAtom(t, c, atom.KindObservation, []string{"sector7", "road", "water"}, map[string]string{"subject": "route", "state": "flooded"}, nil, 1))

	want := GraphHash(atoms, Bonds(atoms))

	rng := rand.New(rand.NewSource(1))
	for i := 0; i < 25; i++ {
		shuffled := append([]atom.Atom{}, atoms...)
		rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
		got := GraphHash(shuffled, Bonds(shuffled))
		if got != want {
			t.Fatalf("permutation %d: GraphHash mismatch\n got  %x\n want %x", i, got, want)
		}
	}
}

func TestThresholdExactness(t *testing.T) {
	a, b := newKP(t), newKP(t)

	need := mkAtom(t, a, atom.KindNeed, []string{"x"}, map[string]string{"resource": "r", "quantity": "1"}, nil, 0)
	capacity := mkAtom(t, b, atom.KindCapacity, []string{"x", "y", "z"}, map[string]string{"resource": "r", "quantity": "1"}, nil, 0)
	bonds := Bonds([]atom.Atom{need, capacity})
	if !hasBondType(bonds, Satisfies) {
		t.Fatalf("J=1/3 exactly must satisfy (>=), got bonds: %+v", bonds)
	}

	o1 := mkAtom(t, a, atom.KindObservation, []string{"x"}, map[string]string{"subject": "s", "state": "clear"}, nil, 0)
	o2 := mkAtom(t, b, atom.KindObservation, []string{"x", "y"}, map[string]string{"subject": "s", "state": "clear"}, nil, 0)
	bonds = Bonds([]atom.Atom{o1, o2})
	if !hasBondType(bonds, Corroborates) {
		t.Fatalf("J=1/2 exactly must corroborate (>=), got bonds: %+v", bonds)
	}
}

func hasBondType(bonds []Bond, ty Type) bool {
	for _, b := range bonds {
		if b.Type == ty {
			return true
		}
	}
	return false
}

func TestSelfCorroborationZero(t *testing.T) {
	a := newKP(t)
	var atoms []atom.Atom
	for i := uint64(0); i < 10; i++ {
		atoms = append(atoms, mkAtom(t, a, atom.KindObservation, []string{"water", "sector7"}, map[string]string{"subject": "route", "state": "clear"}, nil, i))
	}
	bonds := Bonds(atoms)
	for _, b := range bonds {
		if b.Type == Corroborates {
			t.Fatalf("self-corroboration bond formed: %+v", b)
		}
	}
}

func TestCorroboratesContradictsExclusive(t *testing.T) {
	a, b := newKP(t), newKP(t)
	agree := mkAtom(t, a, atom.KindClaim, []string{"x", "y"}, map[string]string{"subject": "s", "state": "up"}, nil, 0)
	disagree1 := mkAtom(t, b, atom.KindClaim, []string{"x", "y"}, map[string]string{"subject": "s", "state": "up"}, nil, 0)
	disagree2 := mkAtom(t, b, atom.KindClaim, []string{"x", "y"}, map[string]string{"subject": "s", "state": "down"}, nil, 0)

	bonds := Bonds([]atom.Atom{agree, disagree1})
	if !hasBondType(bonds, Corroborates) || hasBondType(bonds, Contradicts) {
		t.Fatalf("expected only CORROBORATES, got %+v", bonds)
	}

	bonds = Bonds([]atom.Atom{agree, disagree2})
	if !hasBondType(bonds, Contradicts) || hasBondType(bonds, Corroborates) {
		t.Fatalf("expected only CONTRADICTS, got %+v", bonds)
	}
}

func TestWorkedExample(t *testing.T) {
	a, b, c := newKP(t), newKP(t), newKP(t)

	a1 := mkAtom(t, a, atom.KindNeed, []string{"water", "sector7", "urgent"}, map[string]string{"resource": "water", "quantity": "200"}, nil, 0)
	a2 := mkAtom(t, b, atom.KindCapacity, []string{"water", "sector3", "surplus"}, map[string]string{"resource": "water", "quantity": "500"}, nil, 0)

	bonds := Bonds([]atom.Atom{a1, a2})
	if hasBondType(bonds, Satisfies) {
		t.Fatalf("a1<->a2 should NOT satisfy (J=1/5 < 1/3), got %+v", bonds)
	}

	a3 := mkAtom(t, c, atom.KindRoute, []string{"sector3", "sector7", "road"}, map[string]string{"from": "sector3", "to": "sector7"}, []atom.AtomID{atom.ID(a1), atom.ID(a2)}, 0)

	atoms := []atom.Atom{a1, a2, a3}
	bonds = Bonds(atoms)
	mols := Molecules(atoms, bonds)
	if len(mols) != 1 {
		t.Fatalf("expected 1 molecule, got %d", len(mols))
	}
	if mols[0].Stability != Inert {
		t.Fatalf("expected INERT before a4, got %s", mols[0].Stability)
	}

	a4 := mkAtom(t, b, atom.KindCapacity, []string{"water", "sector7", "surplus", "delivery"}, map[string]string{"resource": "water", "quantity": "500"}, nil, 1)
	atoms = append(atoms, a4)
	bonds = Bonds(atoms)
	if !hasBondType(bonds, Satisfies) {
		t.Fatalf("a1<->a4 should satisfy (J=2/5 >= 1/3), got %+v", bonds)
	}
	mols = Molecules(atoms, bonds)
	if len(mols) != 1 {
		t.Fatalf("expected 1 molecule after a4, got %d", len(mols))
	}
	if mols[0].Stability != Stable {
		t.Fatalf("expected STABLE after a4, got %s", mols[0].Stability)
	}

	d := newKP(t)
	a5 := mkAtom(t, d, atom.KindObservation, []string{"sector7", "road", "water"}, map[string]string{"subject": "route-sector3-sector7", "state": "flooded"}, nil, 0)
	a6 := mkAtom(t, c, atom.KindObservation, []string{"sector7", "road", "water"}, map[string]string{"subject": "route-sector3-sector7", "state": "clear"}, nil, 1)
	atoms = append(atoms, a5, a6)
	bonds = Bonds(atoms)
	if !hasBondType(bonds, Contradicts) {
		t.Fatalf("a5<->a6 should contradict, got %+v", bonds)
	}
	mols = Molecules(atoms, bonds)
	foundUnstable := false
	for _, m := range mols {
		if m.Stability == Unstable {
			foundUnstable = true
		}
	}
	if !foundUnstable {
		t.Fatalf("expected an UNSTABLE molecule after contradiction, got %+v", mols)
	}
}

func TestIsolatedAtomIsOwnMolecule(t *testing.T) {
	a := newKP(t)
	lone := mkAtom(t, a, atom.KindObservation, []string{"x"}, map[string]string{"subject": "s", "state": "up"}, nil, 0)
	mols := Molecules([]atom.Atom{lone}, Bonds([]atom.Atom{lone}))
	if len(mols) != 1 || len(mols[0].Members) != 1 {
		t.Fatalf("expected one singleton molecule, got %+v", mols)
	}
	if mols[0].Stability != Inert {
		t.Fatalf("singleton with no NEED should be INERT, got %s", mols[0].Stability)
	}
}
