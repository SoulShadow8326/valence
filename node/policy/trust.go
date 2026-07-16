package policy

import (
	"crypto/ed25519"
	"sync"
)





type Trust struct {
	mu     sync.RWMutex
	scores map[string]float64
	prior  float64
}

func NewTrust() *Trust {
	return &Trust{scores: make(map[string]float64), prior: 0.5}
}

func keyOf(pub ed25519.PublicKey) string { return string(pub) }



func (t *Trust) Score(pub ed25519.PublicKey) float64 {
	t.mu.RLock()
	defer t.mu.RUnlock()
	if s, ok := t.scores[keyOf(pub)]; ok {
		return s
	}
	return t.prior
}





func (t *Trust) Set(pub ed25519.PublicKey, score float64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.scores[keyOf(pub)] = clamp01(score)
}





func (t *Trust) Adjust(pub ed25519.PublicKey, delta float64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	k := keyOf(pub)
	s, ok := t.scores[k]
	if !ok {
		s = t.prior
	}
	t.scores[k] = clamp01(s + delta)
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}
