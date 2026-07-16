package lip

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"errors"

	"golang.org/x/crypto/chacha20poly1305"
)


type Frame struct {
	SessionID [32]byte
	Ctr       uint32
	Cipher    []byte
}




func nextKey(chain [32]byte) (msgKey, next [32]byte) {
	mk := hmac.New(sha256.New, chain[:])
	mk.Write([]byte{0x01})
	copy(msgKey[:], mk.Sum(nil))

	ck := hmac.New(sha256.New, chain[:])
	ck.Write([]byte{0x02})
	copy(next[:], ck.Sum(nil))
	return
}

func frameNonce(ctr uint32) []byte {
	nonce := make([]byte, chacha20poly1305.NonceSize)
	binary.LittleEndian.PutUint64(nonce[4:], uint64(ctr))
	return nonce
}

func frameAAD(sessionID [32]byte, ctr uint32) []byte {
	aad := make([]byte, 36)
	copy(aad, sessionID[:])
	binary.LittleEndian.PutUint32(aad[32:], ctr)
	return aad
}





func zero(b []byte) {
	for i := range b {
		b[i] = 0
	}
}




func (s *Session) Seal(plaintext []byte) (Frame, error) {
	msgKey, next := nextKey(s.SendChain)
	zero(s.SendChain[:])
	defer zero(msgKey[:])

	aead, err := chacha20poly1305.New(msgKey[:])
	if err != nil {
		return Frame{}, err
	}
	cipher := aead.Seal(nil, frameNonce(s.SendCtr), plaintext, frameAAD(s.SessionID, s.SendCtr))

	f := Frame{SessionID: s.SessionID, Ctr: s.SendCtr, Cipher: cipher}
	s.SendChain = next
	s.SendCtr++
	return f, nil
}






func (s *Session) Open(f Frame) ([]byte, error) {
	if f.SessionID != s.SessionID {
		return nil, errors.New("lip: frame session mismatch")
	}
	if f.Ctr < s.RecvCtr {
		return nil, errors.New("lip: replayed or reordered frame")
	}

	chain := s.RecvChain
	var msgKey [32]byte
	for i := s.RecvCtr; i <= f.Ctr; i++ {
		mk, next := nextKey(chain)
		zero(chain[:])
		if i == f.Ctr {
			msgKey = mk
		} else {
			zero(mk[:])
		}
		chain = next
	}
	defer zero(msgKey[:])

	aead, err := chacha20poly1305.New(msgKey[:])
	if err != nil {
		return nil, err
	}
	pt, err := aead.Open(nil, frameNonce(f.Ctr), f.Cipher, frameAAD(f.SessionID, f.Ctr))
	if err != nil {
		return nil, err
	}

	s.RecvChain = chain
	s.RecvCtr = f.Ctr + 1
	return pt, nil
}
