package engine

import (
	"log"
	"math/rand"
	"net"
	"sync"
	"time"

	"valence/node/keystore"
	"valence/node/peer"
	"valence/node/policy"
	"valence/node/store"
	"valence/node/transport"
	"valence/protocol/atom"
	"valence/protocol/bond"
)





type Node struct {
	Keys      keystore.KeyPair
	Store     *store.Store
	Peers     *peer.Table
	Transport transport.Transport
	Trust     *policy.Trust
	Lip       *LipManager

	seqMu   sync.Mutex
	nextSeq uint64

	stop chan struct{}
}

func New(keys keystore.KeyPair, st *store.Store, pt *peer.Table, tr transport.Transport) *Node {
	return &Node{Keys: keys, Store: st, Peers: pt, Transport: tr, Trust: policy.NewTrust(), stop: make(chan struct{})}
}

func (n *Node) Run() {
	go n.acceptLoop()
	go n.discoveryLoop()
	go n.syncLoop()
	go n.gcLoop()
}

func (n *Node) Stop() { close(n.stop) }





func (n *Node) Publish(kind atom.Kind, tags []string, payload map[string]string, refs []atom.AtomID) (atom.Atom, error) {
	n.seqMu.Lock()
	seq := n.nextSeq
	n.nextSeq++
	n.seqMu.Unlock()

	a, err := atom.New(kind, tags, payload, refs, seq, n.Keys.Priv, n.Keys.Pub)
	if err != nil {
		return atom.Atom{}, err
	}
	if err := n.Store.Put(a); err != nil {
		return atom.Atom{}, err
	}
	return a, nil
}



func (n *Node) Graph() (atoms []atom.Atom, bonds []bond.Bond, molecules []bond.Molecule, hash [32]byte) {
	atoms = n.Store.All()
	bonds = bond.Bonds(atoms)
	molecules = bond.Molecules(atoms, bonds)
	hash = bond.GraphHash(atoms, bonds)
	return
}

func (n *Node) acceptLoop() {
	for {
		select {
		case <-n.stop:
			return
		case conn := <-n.Transport.Accept():
			go n.handleAccepted(conn)
		}
	}
}

func (n *Node) handleAccepted(conn net.Conn) {
	defer conn.Close()
	peerPub, err := peer.Accept(conn, n.Keys)
	if err != nil {
		log.Printf("engine: hello (accept) from %s failed: %v", conn.RemoteAddr(), err)
		return
	}
	n.Peers.Upsert(peerPub, n.Transport.Name(), conn.RemoteAddr().String())

	pulled, pushed, err := runResponder(conn, n.Store)
	if err != nil {
		log.Printf("engine: sync (responder) with %x failed: %v", peerPub[:4], err)
		return
	}
	log.Printf("engine: synced with %x (responder): pulled=%d pushed=%d", peerPub[:4], pulled, pushed)
}

func (n *Node) discoveryLoop() {
	for {
		select {
		case <-n.stop:
			return
		case adv := <-n.Transport.Discovered():
			go n.dialAndSync(adv.Addr)
		}
	}
}

func (n *Node) dialAndSync(addr string) {
	conn, err := n.Transport.Dial(addr)
	if err != nil {
		return
	}
	defer conn.Close()

	peerPub, err := peer.Initiate(conn, n.Keys)
	if err != nil {
		log.Printf("engine: hello (initiate) to %s failed: %v", addr, err)
		return
	}
	n.Peers.Upsert(peerPub, n.Transport.Name(), addr)

	pulled, pushed, err := runInitiator(conn, n.Store)
	if err != nil {
		log.Printf("engine: sync (initiator) with %s failed: %v", addr, err)
		return
	}
	log.Printf("engine: synced with %x (initiator): pulled=%d pushed=%d", peerPub[:4], pulled, pushed)
}














func (n *Node) gcLoop() {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-n.stop:
			return
		case <-ticker.C:
			if dropped := policy.Sweep(n.Store, n.Trust, policy.GCThreshold); dropped > 0 {
				log.Printf("engine: gc dropped %d high-entropy atoms", dropped)
			}
		}
	}
}





func (n *Node) syncLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-n.stop:
			return
		case <-ticker.C:
			for _, pub := range n.Peers.Peers() {
				bindings := n.Peers.Bindings(pub)
				if len(bindings) == 0 {
					continue
				}





				addr := bindings[0].Addr
				go func(addr string) {
					time.Sleep(time.Duration(rand.Intn(2000)) * time.Millisecond)
					n.dialAndSync(addr)
				}(addr)
			}
		}
	}
}
