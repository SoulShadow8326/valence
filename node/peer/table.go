package peer

import (
	"crypto/ed25519"
	"sync"
	"time"
)



type Binding struct {
	Transport string
	Addr      string
	LastSeen  time.Time
}





type Table struct {
	mu       sync.RWMutex
	bindings map[string][]Binding
}

func NewTable() *Table {
	return &Table{bindings: make(map[string][]Binding)}
}

func keyOf(pub ed25519.PublicKey) string { return string(pub) }



func (t *Table) Upsert(pub ed25519.PublicKey, transport, addr string) {
	k := keyOf(pub)
	t.mu.Lock()
	defer t.mu.Unlock()
	bs := t.bindings[k]
	for i, b := range bs {
		if b.Transport == transport && b.Addr == addr {
			bs[i].LastSeen = time.Now()
			return
		}
	}
	t.bindings[k] = append(bs, Binding{Transport: transport, Addr: addr, LastSeen: time.Now()})
}

func (t *Table) Bindings(pub ed25519.PublicKey) []Binding {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return append([]Binding{}, t.bindings[keyOf(pub)]...)
}


func (t *Table) Peers() []ed25519.PublicKey {
	t.mu.RLock()
	defer t.mu.RUnlock()
	out := make([]ed25519.PublicKey, 0, len(t.bindings))
	for k := range t.bindings {
		out = append(out, ed25519.PublicKey(k))
	}
	return out
}
