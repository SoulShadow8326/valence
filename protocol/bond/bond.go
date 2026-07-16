package bond

import (
	"sort"

	"valence/protocol/atom"
)

func Bonds(atoms []atom.Atom) []Bond {
	byID := dedupeByID(atoms)
	ids := sortedIDs(byID)

	ordered := make([]atom.Atom, len(ids))
	for i, id := range ids {
		ordered[i] = byID[id]
	}

	var bonds []Bond
	for i := 0; i < len(ordered); i++ {
		for j := i + 1; j < len(ordered); j++ {
			aID, bID := ids[i], ids[j]
			aAtom, bAtom := ordered[i], ordered[j]

			if bID.Less(aID) {
				aID, bID = bID, aID
				aAtom, bAtom = bAtom, aAtom
			}
			bonds = append(bonds, derivePair(aAtom, bAtom, aID, bID)...)
		}
	}

	sort.Slice(bonds, func(i, j int) bool {
		if bonds[i].A != bonds[j].A {
			return bonds[i].A.Less(bonds[j].A)
		}
		if bonds[i].B != bonds[j].B {
			return bonds[i].B.Less(bonds[j].B)
		}
		return bonds[i].Type < bonds[j].Type
	})
	return bonds
}

func derivePair(a, b atom.Atom, aID, bID atom.AtomID) []Bond {
	var out []Bond
	if bd, ok := contextualizes(a, b, aID, bID); ok {
		out = append(out, bd)
	}
	if bd, ok := satisfies(a, b, aID, bID); ok {
		out = append(out, bd)
	}
	if bd, ok := corroborates(a, b, aID, bID); ok {
		out = append(out, bd)
	}
	if bd, ok := contradicts(a, b, aID, bID); ok {
		out = append(out, bd)
	}
	return out
}

func dedupeByID(atoms []atom.Atom) map[atom.AtomID]atom.Atom {
	m := make(map[atom.AtomID]atom.Atom, len(atoms))
	for _, a := range atoms {
		m[atom.ID(a)] = a
	}
	return m
}

func sortedIDs(m map[atom.AtomID]atom.Atom) []atom.AtomID {
	ids := make([]atom.AtomID, 0, len(m))
	for id := range m {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i].Less(ids[j]) })
	return ids
}
