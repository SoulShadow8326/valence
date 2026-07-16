package lip

import (
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"io"
)

const hsDomain = "valence-lip-v1-hs"



type Session struct {
	SessionID [32]byte
	SendChain [32]byte
	RecvChain [32]byte
	SendCtr   uint32
	RecvCtr   uint32
	PeerID    ed25519.PublicKey
}

func writeShare(w io.Writer, id ed25519.PublicKey, eph *ecdh.PublicKey, nonce [32]byte) error {
	if _, err := w.Write(id); err != nil {
		return err
	}
	if _, err := w.Write(eph.Bytes()); err != nil {
		return err
	}
	_, err := w.Write(nonce[:])
	return err
}

func readShare(r io.Reader) (id ed25519.PublicKey, eph *ecdh.PublicKey, nonce [32]byte, err error) {
	idb := make([]byte, ed25519.PublicKeySize)
	if _, err = io.ReadFull(r, idb); err != nil {
		return
	}
	ephb := make([]byte, 32)
	if _, err = io.ReadFull(r, ephb); err != nil {
		return
	}
	if _, err = io.ReadFull(r, nonce[:]); err != nil {
		return
	}
	eph, err = ecdh.X25519().NewPublicKey(ephb)
	if err != nil {
		return
	}
	id = ed25519.PublicKey(idb)
	return
}

func writeSig(w io.Writer, sig []byte) error {
	var l [4]byte
	binary.LittleEndian.PutUint32(l[:], uint32(len(sig)))
	if _, err := w.Write(l[:]); err != nil {
		return err
	}
	_, err := w.Write(sig)
	return err
}

func readSig(r io.Reader) ([]byte, error) {
	var l [4]byte
	if _, err := io.ReadFull(r, l[:]); err != nil {
		return nil, err
	}
	n := binary.LittleEndian.Uint32(l[:])
	if n > 128 {
		return nil, errors.New("lip: signature too large")
	}
	sig := make([]byte, n)
	_, err := io.ReadFull(r, sig)
	return sig, err
}







func transcript(idA ed25519.PublicKey, ephA []byte, nonceA [32]byte, idB ed25519.PublicKey, ephB []byte, nonceB [32]byte) []byte {
	loID, loEph, loNonce := idA, ephA, nonceA
	hiID, hiEph, hiNonce := idB, ephB, nonceB
	if bytesGreater(idA, idB) {
		loID, loEph, loNonce, hiID, hiEph, hiNonce = idB, ephB, nonceB, idA, ephA, nonceA
	}
	buf := make([]byte, 0, len(loID)+len(loEph)+32+len(hiID)+len(hiEph)+32)
	buf = append(buf, loID...)
	buf = append(buf, loEph...)
	buf = append(buf, loNonce[:]...)
	buf = append(buf, hiID...)
	buf = append(buf, hiEph...)
	buf = append(buf, hiNonce[:]...)
	return buf
}

func bytesGreater(a, b []byte) bool {
	for i := range a {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return false
}

func signedMessage(t []byte) []byte {
	return append([]byte(hsDomain), t...)
}





func Initiate(rw io.ReadWriter, selfID ed25519.PublicKey, selfPriv ed25519.PrivateKey) (*Session, error) {
	curve := ecdh.X25519()
	ephPriv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	var nonceA [32]byte
	if _, err := rand.Read(nonceA[:]); err != nil {
		return nil, err
	}

	if err := writeShare(rw, selfID, ephPriv.PublicKey(), nonceA); err != nil {
		return nil, err
	}

	idB, ephB, nonceB, err := readShare(rw)
	if err != nil {
		return nil, err
	}
	t := transcript(selfID, ephPriv.PublicKey().Bytes(), nonceA, idB, ephB.Bytes(), nonceB)

	sigB, err := readSig(rw)
	if err != nil {
		return nil, err
	}
	if !ed25519.Verify(idB, signedMessage(t), sigB) {
		return nil, errors.New("lip: responder signature invalid")
	}

	sigA := ed25519.Sign(selfPriv, signedMessage(t))
	if err := writeSig(rw, sigA); err != nil {
		return nil, err
	}

	shared, err := ephPriv.ECDH(ephB)
	if err != nil {
		return nil, err
	}
	return deriveSession(t, shared, selfID, idB)
}


func Accept(rw io.ReadWriter, selfID ed25519.PublicKey, selfPriv ed25519.PrivateKey) (*Session, error) {
	curve := ecdh.X25519()
	idA, ephA, nonceA, err := readShare(rw)
	if err != nil {
		return nil, err
	}

	ephPriv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	var nonceB [32]byte
	if _, err := rand.Read(nonceB[:]); err != nil {
		return nil, err
	}
	if err := writeShare(rw, selfID, ephPriv.PublicKey(), nonceB); err != nil {
		return nil, err
	}

	t := transcript(idA, ephA.Bytes(), nonceA, selfID, ephPriv.PublicKey().Bytes(), nonceB)
	sigB := ed25519.Sign(selfPriv, signedMessage(t))
	if err := writeSig(rw, sigB); err != nil {
		return nil, err
	}

	sigA, err := readSig(rw)
	if err != nil {
		return nil, err
	}
	if !ed25519.Verify(idA, signedMessage(t), sigA) {
		return nil, errors.New("lip: initiator signature invalid")
	}

	shared, err := ephPriv.ECDH(ephA)
	if err != nil {
		return nil, err
	}
	return deriveSession(t, shared, selfID, idA)
}





func deriveSession(t []byte, shared []byte, selfID, peerID ed25519.PublicKey) (*Session, error) {
	sessionID := sha256.Sum256(t)

	root, err := hkdf.Key(sha256.New, shared, sessionID[:], "valence-lip-v1-root", 32)
	if err != nil {
		return nil, err
	}

	selfRole, peerRole := byte(0x01), byte(0x00)
	if bytesLess(selfID, peerID) {
		selfRole, peerRole = 0x00, 0x01
	}

	sendChain, err := hkdf.Key(sha256.New, root, nil, chainInfo(selfRole), 32)
	if err != nil {
		return nil, err
	}
	recvChain, err := hkdf.Key(sha256.New, root, nil, chainInfo(peerRole), 32)
	if err != nil {
		return nil, err
	}

	s := &Session{SessionID: sessionID, PeerID: append(ed25519.PublicKey{}, peerID...)}
	copy(s.SendChain[:], sendChain)
	copy(s.RecvChain[:], recvChain)
	return s, nil
}

func chainInfo(role byte) string {
	return string(append([]byte("valence-lip-v1-chain"), role))
}

func bytesLess(a, b []byte) bool {
	for i := range a {
		if a[i] != b[i] {
			return a[i] < b[i]
		}
	}
	return false
}
