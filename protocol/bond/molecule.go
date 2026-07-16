package bond

import (
	"bytes"
	"crypto/sha256"
	"sort"

	"valence/protocol/atom"
)



type Stability uint8

const (
	Inert Stability = iota
	Stable
	Unstable
)

func (s Stability) String() string {
	switch s {
	case Stable:
		return "STABLE"
	case Unstable:
		return "UNSTABLE"
	default:
		return "INERT"
	}
}


type Molecule struct {
	ID        [32]byte
	Members   []atom.AtomID
	Bonds     []Bond
	Stability Stability
}




func Molecules(atoms []atom.Atom, bonds []Bond) []Molecule {
	byID := dedupeByID(atoms)

	uf := newUnionFind()
	for id := range byID {
		uf.find(id)
	}
	for _, b := range bonds {
		uf.union(b.A, b.B)
	}

	groups := make(map[atom.AtomID][]atom.AtomID)
	for id := range byID {
		root := uf.find(id)
		groups[root] = append(groups[root], id)
	}

	molecules := make([]Molecule, 0, len(groups))
	for _, members := range groups {
		sort.Slice(members, func(i, j int) bool { return members[i].Less(members[j]) })

		memberSet := make(map[atom.AtomID]bool, len(members))
		for _, m := range members {
			memberSet[m] = true
		}
		var memberBonds []Bond
		for _, b := range bonds {
			if memberSet[b.A] && memberSet[b.B] {
				memberBonds = append(memberBonds, b)
			}
		}

		molecules = append(molecules, Molecule{
			ID:        moleculeID(members),
			Members:   members,
			Bonds:     memberBonds,
			Stability: evaluateStability(byID, members, memberBonds),
		})
	}

	sort.Slice(molecules, func(i, j int) bool {
		return bytes.Compare(molecules[i].ID[:], molecules[j].ID[:]) < 0
	})
	return molecules
}

func moleculeID(members []atom.AtomID) [32]byte {
	buf := make([]byte, 0, len(members)*32)
	for _, m := range members {
		buf = append(buf, m[:]...)
	}
	return sha256.Sum256(buf)
}




func evaluateStability(byID map[atom.AtomID]atom.Atom, members []atom.AtomID, bonds []Bond) Stability {
	for _, b := range bonds {
		if b.Type == Contradicts {
			return Unstable
		}
	}

	needSatisfied := make(map[atom.AtomID]bool)
	for _, id := range members {
		if byID[id].Kind == atom.KindNeed {
			needSatisfied[id] = false
		}
	}
	if len(needSatisfied) == 0 {
		return Inert
	}
	for _, b := range bonds {
		if b.Type != Satisfies {
			continue
		}
		if _, ok := needSatisfied[b.A]; ok {
			needSatisfied[b.A] = true
		}
		if _, ok := needSatisfied[b.B]; ok {
			needSatisfied[b.B] = true
		}
	}
	for _, satisfied := range needSatisfied {
		if !satisfied {
			return Inert
		}
	}
	return Stable
}






type unionFind struct {
	parent map[atom.AtomID]atom.AtomID
}

func newUnionFind() *unionFind {
	return &unionFind{parent: make(map[atom.AtomID]atom.AtomID)}
}

func (u *unionFind) find(x atom.AtomID) atom.AtomID {
	if _, ok := u.parent[x]; !ok {
		u.parent[x] = x
		return x
	}
	if u.parent[x] != x {
		u.parent[x] = u.find(u.parent[x])
	}
	return u.parent[x]
}

func (u *unionFind) union(a, b atom.AtomID) {
	ra, rb := u.find(a), u.find(b)
	if ra == rb {
		return
	}
	if rb.Less(ra) {
		ra, rb = rb, ra
	}
	u.parent[rb] = ra
}
