package peer

import (
	"crypto/ed25519"
	"net"
	"testing"

	"valence/node/keystore"
)


func kp(t *testing.T) keystore.KeyPair {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	return keystore.KeyPair{Pub: pub, Priv: priv}
}

func TestHelloHandshakeAgrees(t *testing.T) {
	a, b := kp(t), kp(t)
	connA, connB := net.Pipe()

	type result struct {
		id  ed25519.PublicKey
		err error
	}
	resA := make(chan result, 1)
	resB := make(chan result, 1)

	go func() {
		id, err := Initiate(connA, a)
		resA <- result{id, err}
	}()
	go func() {
		id, err := Accept(connB, b)
		resB <- result{id, err}
	}()

	ra, rb := <-resA, <-resB
	if ra.err != nil {
		t.Fatalf("initiate: %v", ra.err)
	}
	if rb.err != nil {
		t.Fatalf("accept: %v", rb.err)
	}
	if !ra.id.Equal(b.Pub) {
		t.Fatal("initiator resolved wrong peer identity")
	}
	if !rb.id.Equal(a.Pub) {
		t.Fatal("responder resolved wrong peer identity")
	}
}





func TestHelloReplayRejected(t *testing.T) {
	a := kp(t)
	var nonceA, nonceB, nonceReplayed [32]byte
	nonceA[0], nonceB[0], nonceReplayed[0] = 1, 2, 3

	sig := ed25519.Sign(a.Priv, transcript(a.Pub, nonceA, nonceB))
	if !ed25519.Verify(a.Pub, transcript(a.Pub, nonceA, nonceB), sig) {
		t.Fatal("sanity: original transcript should verify")
	}
	if ed25519.Verify(a.Pub, transcript(a.Pub, nonceA, nonceReplayed), sig) {
		t.Fatal("captured signature verified against a different peer nonce")
	}
}

func TestHelloMITMRejected(t *testing.T) {
	b, mallory := kp(t), kp(t)

	var nonceA, nonceM [32]byte
	nonceA[0], nonceM[0] = 1, 2
	sigMallory := ed25519.Sign(mallory.Priv, transcript(mallory.Pub, nonceM, nonceA))





	if ed25519.Verify(b.Pub, transcript(mallory.Pub, nonceM, nonceA), sigMallory) {
		t.Fatal("mallory's signature should not verify under b's key")
	}
}
