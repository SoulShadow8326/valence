package atom

import (
	"sort"
	"strings"
)

func NormalizeTag(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ToLower(s)
	s = collapseSpaces(s)
	return s
}

func collapseSpaces(s string) string {
	var b strings.Builder
	prevSpace := false
	for _, r := range s {
		if r == ' ' {
			if !prevSpace {
				b.WriteRune(r)
			}
			prevSpace = true
			continue
		}
		prevSpace = false
		b.WriteRune(r)
	}
	return b.String()
}

func NormalizeTags(tags []string) []string {
	seen := make(map[string]bool, len(tags))
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		nt := NormalizeTag(t)
		if nt == "" || seen[nt] {
			continue
		}
		seen[nt] = true
		out = append(out, nt)
	}
	sort.Strings(out)
	return out
}

func NormalizeRefs(refs []AtomID) []AtomID {
	seen := make(map[AtomID]bool, len(refs))
	out := make([]AtomID, 0, len(refs))
	for _, r := range refs {
		if seen[r] {
			continue
		}
		seen[r] = true
		out = append(out, r)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Less(out[j]) })
	return out
}
