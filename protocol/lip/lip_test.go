package lip

import (
	"crypto/ed25519"
	"fmt"
	"net"
	"testing"

	"valence/protocol/atom"
)

func newIdentity(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	return pub, priv
}

func newSessionPair(t *testing.T) (a, b *Session) {
	t.Helper()
	idA, privA := newIdentity(t)
	idB, privB := newIdentity(t)
	connA, connB := net.Pipe()

	type res struct {
		s   *Session
		err error
	}
	resA := make(chan res, 1)
	resB := make(chan res, 1)
	go func() { s, err := Initiate(connA, idA, privA); resA <- res{s, err} }()
	go func() { s, err := Accept(connB, idB, privB); resB <- res{s, err} }()

	ra, rb := <-resA, <-resB
	if ra.err != nil {
		t.Fatalf("initiate: %v", ra.err)
	}
	if rb.err != nil {
		t.Fatalf("accept: %v", rb.err)
	}
	return ra.s, rb.s
}

func TestHandshakeAgreement(t *testing.T) {
	a, b := newSessionPair(t)
	if a.SessionID != b.SessionID {
		t.Fatalf("SessionID mismatch: %x != %x", a.SessionID, b.SessionID)
	}
	if a.SendChain != b.RecvChain {
		t.Fatal("A's SendChain should equal B's RecvChain")
	}
	if b.SendChain != a.RecvChain {
		t.Fatal("B's SendChain should equal A's RecvChain")
	}
}

func TestMITMRejected(t *testing.T) {
	idB, _ := newIdentity(t)
	idMallory, privMallory := newIdentity(t)

	var ephB, ephMallory [32]byte
	ephB[0], ephMallory[0] = 1, 2
	var nonceB, nonceA [32]byte
	nonceB[0], nonceA[0] = 3, 4

	forged := transcript(idMallory, ephMallory[:], nonceB, idB, ephB[:], nonceA)
	sig := ed25519.Sign(privMallory, signedMessage(forged))

	honest := transcript(idB, ephB[:], nonceB, idB, ephB[:], nonceA)
	if ed25519.Verify(idB, signedMessage(honest), sig) {
		t.Fatal("mallory's signature verified under a transcript she didn't sign")
	}
}

func TestRatchetForwardSecrecy(t *testing.T) {
	a, _ := newSessionPair(t)

	var frames []Frame
	for i := 0; i < 5; i++ {
		f, err := a.Seal([]byte(fmt.Sprintf("msg-%d", i)))
		if err != nil {
			t.Fatal(err)
		}
		frames = append(frames, f)
	}
	leakedChain := a.SendChain

	attacker := &Session{SessionID: a.SessionID, RecvChain: leakedChain, RecvCtr: 0}
	for i, f := range frames {
		if _, err := attacker.Open(f); err == nil {
			t.Fatalf("attacker with leaked current chain key opened frame %d — forward secrecy violated", i)
		}
	}
}

func TestReplayRejected(t *testing.T) {
	a, b := newSessionPair(t)
	f, err := a.Seal([]byte("hello"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := b.Open(f); err != nil {
		t.Fatalf("first open should succeed: %v", err)
	}
	if _, err := b.Open(f); err == nil {
		t.Fatal("replayed frame was accepted")
	}
}

func TestNonceUniqueness(t *testing.T) {
	a, _ := newSessionPair(t)
	seen := make(map[uint32]bool)
	for i := 0; i < 20; i++ {
		f, err := a.Seal([]byte("x"))
		if err != nil {
			t.Fatal(err)
		}
		if seen[f.Ctr] {
			t.Fatalf("counter %d reused", f.Ctr)
		}
		seen[f.Ctr] = true
	}
}

func TestFrameWireRoundTrip(t *testing.T) {
	a, b := newSessionPair(t)
	f, err := a.Seal([]byte("hello valence"))
	if err != nil {
		t.Fatal(err)
	}

	decoded, err := DecodeFrame(EncodeFrame(f))
	if err != nil {
		t.Fatal(err)
	}
	pt, err := b.Open(decoded)
	if err != nil {
		t.Fatalf("open after wire round-trip: %v", err)
	}
	if string(pt) != "hello valence" {
		t.Fatalf("got %q", pt)
	}
}

func TestEndToEndConversationAndCrystallize(t *testing.T) {
	a, b := newSessionPair(t)

	f, err := a.Seal([]byte("the bridge at sector3 is out"))
	if err != nil {
		t.Fatal(err)
	}
	pt, err := b.Open(f)
	if err != nil {
		t.Fatal(err)
	}
	if string(pt) != "the bridge at sector3 is out" {
		t.Fatalf("got %q", pt)
	}

	pub, priv := newIdentity(t)
	crystallized, err := Crystallize(atom.KindObservation,
		[]string{"sector3", "bridge"},
		map[string]string{"subject": "bridge-sector3", "state": "out"},
		nil, 0, priv, pub)
	if err != nil {
		t.Fatal(err)
	}
	if err := atom.Verify(crystallized); err != nil {
		t.Fatalf("crystallized atom fails verification: %v", err)
	}
}
