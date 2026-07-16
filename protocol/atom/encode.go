package atom

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"sort"
)

func putU32(buf *bytes.Buffer, v uint32) {
	var b [4]byte
	binary.LittleEndian.PutUint32(b[:], v)
	buf.Write(b[:])
}

func putU64(buf *bytes.Buffer, v uint64) {
	var b [8]byte
	binary.LittleEndian.PutUint64(b[:], v)
	buf.Write(b[:])
}

func putU32Bytes(buf *bytes.Buffer, b []byte) {
	putU32(buf, uint32(len(b)))
	buf.Write(b)
}

func putU32String(buf *bytes.Buffer, s string) {
	putU32(buf, uint32(len(s)))
	buf.WriteString(s)
}

func Canonical(a Atom) []byte {
	var buf bytes.Buffer

	putU32String(&buf, string(a.Kind))

	putU32(&buf, uint32(len(a.Tags)))
	for _, t := range a.Tags {
		putU32String(&buf, t)
	}

	keys := make([]string, 0, len(a.Payload))
	for k := range a.Payload {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	putU32(&buf, uint32(len(keys)))
	for _, k := range keys {
		putU32String(&buf, k)
		putU32String(&buf, a.Payload[k])
	}

	putU32(&buf, uint32(len(a.Refs)))
	for _, r := range a.Refs {
		buf.Write(r[:])
	}

	putU32Bytes(&buf, a.Clock.Pub)
	putU64(&buf, a.Clock.Seq)

	putU32Bytes(&buf, a.PubKey)

	return buf.Bytes()
}

func Marshal(a Atom) []byte {
	var buf bytes.Buffer
	buf.Write(Canonical(a))
	putU32Bytes(&buf, a.Sig)
	return buf.Bytes()
}

type reader struct {
	b []byte
	i int
}

func (r *reader) u32() (uint32, error) {
	if len(r.b)-r.i < 4 {
		return 0, io.ErrUnexpectedEOF
	}
	v := binary.LittleEndian.Uint32(r.b[r.i:])
	r.i += 4
	return v, nil
}

func (r *reader) u64() (uint64, error) {
	if len(r.b)-r.i < 8 {
		return 0, io.ErrUnexpectedEOF
	}
	v := binary.LittleEndian.Uint64(r.b[r.i:])
	r.i += 8
	return v, nil
}

func (r *reader) bytesN(n uint32, max int) ([]byte, error) {
	if int(n) > max {
		return nil, fmt.Errorf("atom: field length %d exceeds max %d", n, max)
	}
	if uint64(r.i)+uint64(n) > uint64(len(r.b)) {
		return nil, io.ErrUnexpectedEOF
	}
	out := r.b[r.i : r.i+int(n)]
	r.i += int(n)
	return out, nil
}

func (r *reader) stringN(max int) (string, error) {
	n, err := r.u32()
	if err != nil {
		return "", err
	}
	b, err := r.bytesN(n, max)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func Unmarshal(b []byte) (Atom, error) {
	if len(b) > MaxEncodedBytes+4+64 {
		return Atom{}, fmt.Errorf("atom: encoded size %d exceeds max", len(b))
	}
	r := &reader{b: b}

	kind, err := r.stringN(64)
	if err != nil {
		return Atom{}, fmt.Errorf("atom: kind: %w", err)
	}

	numTags, err := r.u32()
	if err != nil {
		return Atom{}, err
	}
	if numTags > MaxTags {
		return Atom{}, fmt.Errorf("atom: %d tags exceeds max %d", numTags, MaxTags)
	}
	tags := make([]string, numTags)
	for i := range tags {
		tags[i], err = r.stringN(MaxTagBytes)
		if err != nil {
			return Atom{}, fmt.Errorf("atom: tag %d: %w", i, err)
		}
	}

	numPayload, err := r.u32()
	if err != nil {
		return Atom{}, err
	}
	if numPayload > MaxPayloadKeys {
		return Atom{}, fmt.Errorf("atom: %d payload keys exceeds max %d", numPayload, MaxPayloadKeys)
	}
	payload := make(map[string]string, numPayload)
	for i := 0; i < int(numPayload); i++ {
		k, err := r.stringN(MaxPayloadKeyBytes)
		if err != nil {
			return Atom{}, fmt.Errorf("atom: payload key %d: %w", i, err)
		}
		v, err := r.stringN(MaxPayloadValueBytes)
		if err != nil {
			return Atom{}, fmt.Errorf("atom: payload value %d: %w", i, err)
		}
		payload[k] = v
	}

	numRefs, err := r.u32()
	if err != nil {
		return Atom{}, err
	}
	if numRefs > MaxRefs {
		return Atom{}, fmt.Errorf("atom: %d refs exceeds max %d", numRefs, MaxRefs)
	}
	refs := make([]AtomID, numRefs)
	for i := range refs {
		rb, err := r.bytesN(32, 32)
		if err != nil {
			return Atom{}, fmt.Errorf("atom: ref %d: %w", i, err)
		}
		copy(refs[i][:], rb)
	}

	clockPubLen, err := r.u32()
	if err != nil {
		return Atom{}, err
	}
	clockPub, err := r.bytesN(clockPubLen, 64)
	if err != nil {
		return Atom{}, fmt.Errorf("atom: clock pub: %w", err)
	}
	seq, err := r.u64()
	if err != nil {
		return Atom{}, err
	}

	pubLen, err := r.u32()
	if err != nil {
		return Atom{}, err
	}
	pub, err := r.bytesN(pubLen, 64)
	if err != nil {
		return Atom{}, fmt.Errorf("atom: pubkey: %w", err)
	}

	sigLen, err := r.u32()
	if err != nil {
		return Atom{}, err
	}
	sig, err := r.bytesN(sigLen, 128)
	if err != nil {
		return Atom{}, fmt.Errorf("atom: sig: %w", err)
	}

	return Atom{
		Kind:    Kind(kind),
		Tags:    tags,
		Payload: payload,
		Refs:    refs,
		Clock:   Clock{Pub: append([]byte{}, clockPub...), Seq: seq},
		PubKey:  append([]byte{}, pub...),
		Sig:     append([]byte{}, sig...),
	}, nil
}
