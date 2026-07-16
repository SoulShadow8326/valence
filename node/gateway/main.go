package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"valence/node/api"
	"valence/node/engine"
	"valence/node/keystore"
	"valence/node/peer"
	"valence/node/store"
	"valence/node/transport"
)

type tenant struct {
	srv      *api.Server
	node     *engine.Node
	pub      string
	lastSeen time.Time
}

func (t *tenant) stop() {
	t.node.Stop()
	if t.node.Lip != nil {
		_ = t.node.Lip.Close()
	}
	if t.node.Transport != nil {
		_ = t.node.Transport.Close()
	}
}

type gateway struct {
	mu      sync.Mutex
	tenants map[string]*tenant
	byPub   map[string]*tenant
	max     int
	ttl     time.Duration
}

func keysFromID(id string) keystore.KeyPair {
	seed := sha256.Sum256([]byte(id))
	priv := ed25519.NewKeyFromSeed(seed[:])
	pub := priv.Public().(ed25519.PublicKey)
	return keystore.KeyPair{Pub: pub, Priv: priv}
}

func newTenant(id string) (*tenant, error) {
	keys := keysFromID(id)

	st := store.New()
	pt := peer.NewTable()

	tr, err := transport.NewMDNS(keys.Pub, "127.0.0.1:0")
	if err != nil {
		return nil, err
	}

	n := engine.New(keys, st, pt, tr)
	n.Run()

	lip, err := engine.NewLipManager(keys, "127.0.0.1:0")
	if err != nil {
		n.Stop()
		_ = tr.Close()
		return nil, err
	}
	n.Lip = lip

	return &tenant{
		srv:      api.New(n),
		node:     n,
		pub:      hex.EncodeToString(keys.Pub),
		lastSeen: time.Now(),
	}, nil
}

func (g *gateway) get(id string) (*tenant, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if t, ok := g.tenants[id]; ok {
		t.lastSeen = time.Now()
		return t, nil
	}
	if len(g.tenants) >= g.max {
		g.evictOldestLocked()
	}
	t, err := newTenant(id)
	if err != nil {
		return nil, err
	}
	g.tenants[id] = t
	g.byPub[t.pub] = t
	log.Printf("gateway: spun up node for %s… (%d live)", id[:min(6, len(id))], len(g.tenants))
	return t, nil
}

func (g *gateway) lipAddrForPub(pub string) (string, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	t, ok := g.byPub[pub]
	if !ok {
		return "", false
	}
	t.lastSeen = time.Now()
	return t.node.Lip.Addr(), true
}

func isHex64(s string) bool {
	if len(s) != 64 {
		return false
	}
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}

func (g *gateway) evictOldestLocked() {
	var oldestID string
	var oldest time.Time
	for id, t := range g.tenants {
		if oldestID == "" || t.lastSeen.Before(oldest) {
			oldestID, oldest = id, t.lastSeen
		}
	}
	if oldestID != "" {
		victim := g.tenants[oldestID]
		victim.stop()
		delete(g.tenants, oldestID)
		delete(g.byPub, victim.pub)
		log.Printf("gateway: evicted node %s… (capacity)", oldestID[:min(6, len(oldestID))])
	}
}

func (g *gateway) sweep() {
	for range time.Tick(time.Minute) {
		cutoff := time.Now().Add(-g.ttl)
		g.mu.Lock()
		for id, t := range g.tenants {
			if t.lastSeen.Before(cutoff) {
				t.stop()
				delete(g.tenants, id)
				delete(g.byPub, t.pub)
				log.Printf("gateway: evicted node %s… (idle)", id[:min(6, len(id))])
			}
		}
		g.mu.Unlock()
	}
}

func normalizeID(raw string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(raw) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
		if b.Len() >= 128 {
			break
		}
	}
	return b.String()
}

func (g *gateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		return
	}

	path := r.URL.Path
	if path == "/" || path == "/health" {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		_, _ = w.Write([]byte("valence gateway ok"))
		return
	}
	if !strings.HasPrefix(path, "/n/") {
		http.NotFound(w, r)
		return
	}

	rest := strings.TrimPrefix(path, "/n/")
	token, sub := rest, "/"
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		token, sub = rest[:i], rest[i:]
	}
	id := normalizeID(token)
	if id == "" {
		http.Error(w, "bad node id", http.StatusBadRequest)
		return
	}

	t, err := g.get(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	r2 := r.Clone(r.Context())
	r2.URL.Path = sub
	r2.URL.RawPath = ""

	if r.Method == http.MethodPost && sub == "/lip/dial" {
		body, _ := io.ReadAll(r.Body)
		var req map[string]any
		if json.Unmarshal(body, &req) == nil {
			if addr, ok := req["addr"].(string); ok && addr != "" && !strings.Contains(addr, ":") {
				if isHex64(addr) {
					if a, found := g.lipAddrForPub(addr); found {
						req["addr"] = a
						body, _ = json.Marshal(req)
					}
				} else if target, terr := g.get(normalizeID(addr)); terr == nil {
					req["addr"] = target.node.Lip.Addr()
					body, _ = json.Marshal(req)
				}
			}
		}
		r2.Body = io.NopCloser(bytes.NewReader(body))
		r2.ContentLength = int64(len(body))
		r2.Header.Del("Content-Length")
	}

	t.srv.Handler().ServeHTTP(w, r2)
}

func main() {
	addr := flag.String("addr", ":8080", "public HTTP bind address")
	maxNodes := flag.Int("max", 250, "max concurrent hosted nodes")
	idle := flag.Duration("idle", 30*time.Minute, "evict a node after this long idle")
	flag.Parse()

	g := &gateway{
		tenants: map[string]*tenant{},
		byPub:   map[string]*tenant{},
		max:     *maxNodes,
		ttl:     *idle,
	}
	go g.sweep()

	log.Printf("valence gateway on %s (max %d nodes, idle %s)", *addr, *maxNodes, *idle)
	log.Fatal(http.ListenAndServe(*addr, g))
}
