package sync

import (
	"sort"

	"valence/protocol/atom"
)




func BucketIDs(ids []atom.AtomID, buckets []int) []atom.AtomID {
	want := make(map[int]bool, len(buckets))
	for _, b := range buckets {
		want[b] = true
	}
	var out []atom.AtomID
	for _, id := range ids {
		if want[int(id[0])] {
			out = append(out, id)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Less(out[j]) })
	return out
}



func Missing(have, theirs []atom.AtomID) []atom.AtomID {
	haveSet := make(map[atom.AtomID]bool, len(have))
	for _, id := range have {
		haveSet[id] = true
	}
	var out []atom.AtomID
	for _, id := range theirs {
		if !haveSet[id] {
			out = append(out, id)
		}
	}
	return out
}
