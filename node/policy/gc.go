package policy

import (
	"valence/node/store"
	"valence/protocol/atom"
	"valence/protocol/bond"
)






const GCThreshold = 0.8







func Sweep(st *store.Store, trust *Trust, threshold float64) int {
	atoms := st.All()
	bonds := bond.Bonds(atoms)

	dropped := 0
	for _, a := range atoms {
		id := atom.ID(a)
		firstSeen, ok := st.FirstSeen(id)
		if !ok {
			continue
		}
		if Entropy(a, firstSeen, bonds, trust) > threshold {
			st.Delete(id)
			dropped++
		}
	}
	return dropped
}
