package bond

import (
	"crypto/sha256"
	"encoding/binary"
	"io"
	"sort"

	"valence/protocol/atom"
)




func GraphHash(atoms []atom.Atom, bonds []Bond) [32]byte {
	ids := make([]atom.AtomID, len(atoms))
	for i, a := range atoms {
		ids[i] = atom.ID(a)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i].Less(ids[j]) })

	sortedBonds := append([]Bond{}, bonds...)
	sort.Slice(sortedBonds, func(i, j int) bool {
		if sortedBonds[i].A != sortedBonds[j].A {
			return sortedBonds[i].A.Less(sortedBonds[j].A)
		}
		if sortedBonds[i].B != sortedBonds[j].B {
			return sortedBonds[i].B.Less(sortedBonds[j].B)
		}
		return sortedBonds[i].Type < sortedBonds[j].Type
	})

	h := sha256.New()
	writeU32(h, uint32(len(ids)))
	for _, id := range ids {
		h.Write(id[:])
	}
	writeU32(h, uint32(len(sortedBonds)))
	for _, b := range sortedBonds {
		h.Write(b.A[:])
		h.Write(b.B[:])
		h.Write([]byte{byte(b.Type)})
	}

	var out [32]byte
	copy(out[:], h.Sum(nil))
	return out
}

func writeU32(w io.Writer, v uint32) {
	var b [4]byte
	binary.LittleEndian.PutUint32(b[:], v)
	w.Write(b[:])
}
