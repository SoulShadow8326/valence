package sync

import (
	"crypto/sha256"
	"sort"

	"valence/protocol/atom"
)



const NumBuckets = 256




type Digest struct {
	Buckets [NumBuckets][32]byte
}



func BuildDigest(ids []atom.AtomID) Digest {
	buckets := make([][]atom.AtomID, NumBuckets)
	for _, id := range ids {
		buckets[id[0]] = append(buckets[id[0]], id)
	}
	var d Digest
	for i, members := range buckets {
		if len(members) == 0 {
			continue
		}
		sort.Slice(members, func(a, b int) bool { return members[a].Less(members[b]) })
		h := sha256.New()
		for _, m := range members {
			h.Write(m[:])
		}
		copy(d.Buckets[i][:], h.Sum(nil))
	}
	return d
}



func MismatchedBuckets(a, b Digest) []int {
	var out []int
	for i := 0; i < NumBuckets; i++ {
		if a.Buckets[i] != b.Buckets[i] {
			out = append(out, i)
		}
	}
	return out
}
