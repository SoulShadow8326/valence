package peer

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"io"

	"valence/node/keystore"
)

const helloDomain = "valence-hello-v1"

func transcript(id ed25519.PublicKey, ownNonce, peerNonce [32]byte) []byte {
	buf := make([]byte, 0, len(helloDomain)+len(id)+64)
	buf = append(buf, helloDomain...)
	buf = append(buf, id...)
	buf = append(buf, ownNonce[:]...)
	buf = append(buf, peerNonce[:]...)
	return buf
}

func writeIDNonce(w io.Writer, id ed25519.PublicKey, nonce [32]byte) error {
	if _, err := w.Write(id); err != nil {
		return err
	}
	_, err := w.Write(nonce[:])
	return err
}

func readIDNonce(r io.Reader) (ed25519.PublicKey, [32]byte, error) {
	id := make([]byte, ed25519.PublicKeySize)
	if _, err := io.ReadFull(r, id); err != nil {
		return nil, [32]byte{}, err
	}
	var nonce [32]byte
	if _, err := io.ReadFull(r, nonce[:]); err != nil {
		return nil, [32]byte{}, err
	}
	return id, nonce, nil
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
		return nil, errors.New("peer: hello signature too large")
	}
	sig := make([]byte, n)
	_, err := io.ReadFull(r, sig)
	return sig, err
}

func writeHello(w io.Writer, id ed25519.PublicKey, nonce [32]byte, sig []byte) error {
	if err := writeIDNonce(w, id, nonce); err != nil {
		return err
	}
	return writeSig(w, sig)
}

func readHello(r io.Reader) (ed25519.PublicKey, [32]byte, []byte, error) {
	id, nonce, err := readIDNonce(r)
	if err != nil {
		return nil, [32]byte{}, nil, err
	}
	sig, err := readSig(r)
	return id, nonce, sig, err
}

func Initiate(rw io.ReadWriter, self keystore.KeyPair) (ed25519.PublicKey, error) {
	var nonceA [32]byte
	if _, err := rand.Read(nonceA[:]); err != nil {
		return nil, err
	}
	if err := writeIDNonce(rw, self.Pub, nonceA); err != nil {
		return nil, err
	}

	idB, nonceB, sigB, err := readHello(rw)
	if err != nil {
		return nil, err
	}
	if len(idB) != ed25519.PublicKeySize {
		return nil, errors.New("peer: bad responder identity length")
	}
	if !ed25519.Verify(idB, transcript(idB, nonceB, nonceA), sigB) {
		return nil, errors.New("peer: responder signature invalid")
	}

	sigA := ed25519.Sign(self.Priv, transcript(self.Pub, nonceA, nonceB))
	if err := writeSig(rw, sigA); err != nil {
		return nil, err
	}
	return idB, nil
}

func Accept(rw io.ReadWriter, self keystore.KeyPair) (ed25519.PublicKey, error) {
	idA, nonceA, err := readIDNonce(rw)
	if err != nil {
		return nil, err
	}
	if len(idA) != ed25519.PublicKeySize {
		return nil, errors.New("peer: bad initiator identity length")
	}

	var nonceB [32]byte
	if _, err := rand.Read(nonceB[:]); err != nil {
		return nil, err
	}
	sigB := ed25519.Sign(self.Priv, transcript(self.Pub, nonceB, nonceA))
	if err := writeHello(rw, self.Pub, nonceB, sigB); err != nil {
		return nil, err
	}

	sigA, err := readSig(rw)
	if err != nil {
		return nil, err
	}
	if !ed25519.Verify(idA, transcript(idA, nonceA, nonceB), sigA) {
		return nil, errors.New("peer: initiator signature invalid")
	}
	return idA, nil
}
