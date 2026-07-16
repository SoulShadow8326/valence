package bond

import "valence/protocol/atom"

type Type uint8

const (
	Corroborates Type = iota
	Satisfies
	Contradicts
	Contextualizes
	Enables
)

func (t Type) String() string {
	switch t {
	case Corroborates:
		return "CORROBORATES"
	case Satisfies:
		return "SATISFIES"
	case Contradicts:
		return "CONTRADICTS"
	case Contextualizes:
		return "CONTEXTUALIZES"
	case Enables:
		return "ENABLES"
	default:
		return "UNKNOWN"
	}
}

type Bond struct {
	A, B     atom.AtomID
	Type     Type
	Strength float64
}

func contextualizes(a, b atom.Atom, aID, bID atom.AtomID) (Bond, bool) {
	if containsRef(a.Refs, bID) || containsRef(b.Refs, aID) {
		return Bond{A: aID, B: bID, Type: Contextualizes, Strength: 1.0}, true
	}
	return Bond{}, false
}

func satisfies(a, b atom.Atom, aID, bID atom.AtomID) (Bond, bool) {
	var need, capacity atom.Atom
	switch {
	case a.Kind == atom.KindNeed && b.Kind == atom.KindCapacity:
		need, capacity = a, b
	case a.Kind == atom.KindCapacity && b.Kind == atom.KindNeed:
		need, capacity = b, a
	default:
		return Bond{}, false
	}
	if need.Payload["resource"] != capacity.Payload["resource"] {
		return Bond{}, false
	}
	if !sharesLocation(a.Tags, b.Tags, need.Payload["resource"]) {
		return Bond{}, false
	}
	if !jaccardMeets(a.Tags, b.Tags, ThresholdSatisfies) {
		return Bond{}, false
	}
	return Bond{A: aID, B: bID, Type: Satisfies, Strength: jaccardFloat(a.Tags, b.Tags)}, true
}

func enables(a, b atom.Atom, aID, bID atom.AtomID) (Bond, bool) {
	var route, other atom.Atom
	switch {
	case a.Kind == atom.KindRoute && (b.Kind == atom.KindNeed || b.Kind == atom.KindCapacity):
		route, other = a, b
	case b.Kind == atom.KindRoute && (a.Kind == atom.KindNeed || a.Kind == atom.KindCapacity):
		route, other = b, a
	default:
		return Bond{}, false
	}
	from, to := route.Payload["from"], route.Payload["to"]
	if (from != "" && hasTag(other.Tags, from)) || (to != "" && hasTag(other.Tags, to)) {
		return Bond{A: aID, B: bID, Type: Enables, Strength: 1.0}, true
	}
	return Bond{}, false
}

func sharesLocation(a, b []string, resource string) bool {
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		switch {
		case a[i] == b[j]:
			if a[i] != resource {
				return true
			}
			i++
			j++
		case a[i] < b[j]:
			i++
		default:
			j++
		}
	}
	return false
}

func hasTag(tags []string, t string) bool {
	for _, x := range tags {
		if x == t {
			return true
		}
	}
	return false
}

func corroborates(a, b atom.Atom, aID, bID atom.AtomID) (Bond, bool) {
	if !sameEvidenceKind(a, b) {
		return Bond{}, false
	}
	if bytesEqual(a.PubKey, b.PubKey) {
		return Bond{}, false
	}
	if a.Payload["subject"] != b.Payload["subject"] {
		return Bond{}, false
	}
	if a.Payload["state"] != b.Payload["state"] {
		return Bond{}, false
	}
	if !jaccardMeets(a.Tags, b.Tags, ThresholdCorroborates) {
		return Bond{}, false
	}
	return Bond{A: aID, B: bID, Type: Corroborates, Strength: jaccardFloat(a.Tags, b.Tags)}, true
}

func contradicts(a, b atom.Atom, aID, bID atom.AtomID) (Bond, bool) {
	if !sameEvidenceKind(a, b) {
		return Bond{}, false
	}
	if a.Payload["subject"] != b.Payload["subject"] {
		return Bond{}, false
	}
	if a.Payload["state"] == b.Payload["state"] {
		return Bond{}, false
	}
	if !jaccardMeets(a.Tags, b.Tags, ThresholdContradicts) {
		return Bond{}, false
	}
	return Bond{A: aID, B: bID, Type: Contradicts, Strength: jaccardFloat(a.Tags, b.Tags)}, true
}

func sameEvidenceKind(a, b atom.Atom) bool {
	if a.Kind != b.Kind {
		return false
	}
	return a.Kind == atom.KindObservation || a.Kind == atom.KindClaim
}

func containsRef(refs []atom.AtomID, id atom.AtomID) bool {
	for _, r := range refs {
		if r == id {
			return true
		}
	}
	return false
}

func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
