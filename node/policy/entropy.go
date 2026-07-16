package policy

import (
	"math"
	"time"

	"valence/protocol/atom"
	"valence/protocol/bond"
)

const (
	weightAge   = 0.3
	weightCorr  = 0.4
	weightTrust = 0.3
	halfLife    = 24 * time.Hour
)

func Entropy(a atom.Atom, firstSeen time.Time, bonds []bond.Bond, trust *Trust) float64 {
	id := atom.ID(a)

	age := time.Since(firstSeen)
	ageTerm := 1 - math.Pow(2, -age.Hours()/halfLife.Hours())

	corrCount := 0
	for _, b := range bonds {
		if b.Type == bond.Corroborates && (b.A == id || b.B == id) {
			corrCount++
		}
	}
	corrTerm := 1 / float64(1+corrCount)

	trustTerm := 1 - trust.Score(a.PubKey)

	return weightAge*ageTerm + weightCorr*corrTerm + weightTrust*trustTerm
}
