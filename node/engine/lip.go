package engine

import (
	"encoding/hex"
	"fmt"
	"net"
	"sync"

	"valence/node/keystore"
	"valence/protocol/lip"
)

type LipManager struct {
	keys     keystore.KeyPair
	listener net.Listener

	mu       sync.Mutex
	sessions map[string]*lipConn

	Incoming chan LipEvent
}

type lipConn struct {
	conn    net.Conn
	session *lip.Session
	mu      sync.Mutex
}

type LipEvent struct {
	SessionID string
	PeerID    string
	Plaintext []byte
}

func NewLipManager(keys keystore.KeyPair, listenAddr string) (*LipManager, error) {
	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return nil, err
	}
	m := &LipManager{
		keys:     keys,
		listener: ln,
		sessions: make(map[string]*lipConn),
		Incoming: make(chan LipEvent, 32),
	}
	go m.acceptLoop()
	return m, nil
}

func (m *LipManager) Addr() string { return m.listener.Addr().String() }

func (m *LipManager) Close() error { return m.listener.Close() }

func (m *LipManager) acceptLoop() {
	for {
		conn, err := m.listener.Accept()
		if err != nil {
			return
		}
		go func() {
			sess, err := lip.Accept(conn, m.keys.Pub, m.keys.Priv)
			if err != nil {
				conn.Close()
				return
			}
			m.register(conn, sess)
		}()
	}
}

func (m *LipManager) Dial(addr string) (string, error) {
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return "", err
	}
	sess, err := lip.Initiate(conn, m.keys.Pub, m.keys.Priv)
	if err != nil {
		conn.Close()
		return "", err
	}
	return m.register(conn, sess), nil
}

func (m *LipManager) register(conn net.Conn, sess *lip.Session) string {
	key := hex.EncodeToString(sess.SessionID[:])
	lc := &lipConn{conn: conn, session: sess}
	m.mu.Lock()
	m.sessions[key] = lc
	m.mu.Unlock()
	go m.readLoop(key, lc)
	return key
}

func (m *LipManager) readLoop(key string, lc *lipConn) {
	defer func() {
		m.mu.Lock()
		delete(m.sessions, key)
		m.mu.Unlock()
		lc.conn.Close()
	}()
	for {
		b, err := readFrame(lc.conn)
		if err != nil {
			return
		}
		f, err := lip.DecodeFrame(b)
		if err != nil {
			continue
		}
		lc.mu.Lock()
		pt, err := lc.session.Open(f)
		peerID := hex.EncodeToString(lc.session.PeerID)
		lc.mu.Unlock()
		if err != nil {
			continue
		}
		m.Incoming <- LipEvent{SessionID: key, PeerID: peerID, Plaintext: pt}
	}
}

func (m *LipManager) Send(sessionID string, plaintext []byte) error {
	m.mu.Lock()
	lc, ok := m.sessions[sessionID]
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("lip: unknown session %s", sessionID)
	}

	lc.mu.Lock()
	f, err := lc.session.Seal(plaintext)
	lc.mu.Unlock()
	if err != nil {
		return err
	}
	return writeFrame(lc.conn, lip.EncodeFrame(f))
}

func (m *LipManager) CloseSession(sessionID string) {
	m.mu.Lock()
	lc, ok := m.sessions[sessionID]
	delete(m.sessions, sessionID)
	m.mu.Unlock()
	if ok {
		lc.conn.Close()
	}
}

func (m *LipManager) PeerOf(sessionID string) (string, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	lc, ok := m.sessions[sessionID]
	if !ok {
		return "", false
	}
	return hex.EncodeToString(lc.session.PeerID), true
}
