package sync

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"

	"valence/protocol/atom"
)

const (
	TagHello    byte = 0x01
	TagDigest   byte = 0x10
	TagWant     byte = 0x11
	TagIDs      byte = 0x12
	TagPull     byte = 0x13
	TagAtoms    byte = 0x14
	TagLipHS    byte = 0x20
	TagLipFrame byte = 0x21
)

const (
	MaxIDsPerMessage = 4096

	MaxAtomsPerMessage = 8
	MaxAtomsBodyBytes  = 64 * 1024
)

func putU32(buf *bytes.Buffer, v uint32) {
	var b [4]byte
	binary.LittleEndian.PutUint32(b[:], v)
	buf.Write(b[:])
}

type boundsReader struct {
	b []byte
	i int
}

func (r *boundsReader) u32() (uint32, error) {
	if len(r.b)-r.i < 4 {
		return 0, io.ErrUnexpectedEOF
	}
	v := binary.LittleEndian.Uint32(r.b[r.i:])
	r.i += 4
	return v, nil
}

func (r *boundsReader) bytesN(n uint32, max int) ([]byte, error) {
	if int(n) > max {
		return nil, fmt.Errorf("sync: field length %d exceeds max %d", n, max)
	}
	if uint64(r.i)+uint64(n) > uint64(len(r.b)) {
		return nil, io.ErrUnexpectedEOF
	}
	out := r.b[r.i : r.i+int(n)]
	r.i += int(n)
	return out, nil
}

func EncodeDigest(d Digest) []byte {
	var buf bytes.Buffer
	buf.WriteByte(TagDigest)
	for _, b := range d.Buckets {
		buf.Write(b[:])
	}
	return buf.Bytes()
}

func DecodeDigest(b []byte) (Digest, error) {
	if len(b) < 1 || b[0] != TagDigest {
		return Digest{}, fmt.Errorf("sync: not a DIGEST message")
	}
	want := 1 + NumBuckets*32
	if len(b) != want {
		return Digest{}, fmt.Errorf("sync: DIGEST wrong size %d, want %d", len(b), want)
	}
	var d Digest
	for i := 0; i < NumBuckets; i++ {
		copy(d.Buckets[i][:], b[1+i*32:1+(i+1)*32])
	}
	return d, nil
}

func EncodeWant(buckets []int) []byte {
	var buf bytes.Buffer
	buf.WriteByte(TagWant)
	putU32(&buf, uint32(len(buckets)))
	for _, idx := range buckets {
		buf.WriteByte(byte(idx))
	}
	return buf.Bytes()
}

func DecodeWant(b []byte) ([]int, error) {
	if len(b) < 1 || b[0] != TagWant {
		return nil, fmt.Errorf("sync: not a WANT message")
	}
	r := &boundsReader{b: b, i: 1}
	n, err := r.u32()
	if err != nil {
		return nil, err
	}
	if n > NumBuckets {
		return nil, fmt.Errorf("sync: WANT lists %d buckets, max %d", n, NumBuckets)
	}
	raw, err := r.bytesN(n, NumBuckets)
	if err != nil {
		return nil, err
	}
	out := make([]int, len(raw))
	for i, bk := range raw {
		out[i] = int(bk)
	}
	return out, nil
}

func encodeIDList(tag byte, ids []atom.AtomID) []byte {
	var buf bytes.Buffer
	buf.WriteByte(tag)
	putU32(&buf, uint32(len(ids)))
	for _, id := range ids {
		buf.Write(id[:])
	}
	return buf.Bytes()
}

func decodeIDList(tag byte, b []byte) ([]atom.AtomID, error) {
	if len(b) < 1 || b[0] != tag {
		return nil, fmt.Errorf("sync: unexpected tag %#x, want %#x", b[0], tag)
	}
	r := &boundsReader{b: b, i: 1}
	n, err := r.u32()
	if err != nil {
		return nil, err
	}
	if n > MaxIDsPerMessage {
		return nil, fmt.Errorf("sync: %d ids exceeds max %d", n, MaxIDsPerMessage)
	}
	out := make([]atom.AtomID, n)
	for i := range out {
		idb, err := r.bytesN(32, 32)
		if err != nil {
			return nil, err
		}
		copy(out[i][:], idb)
	}
	return out, nil
}

func EncodeIDs(ids []atom.AtomID) []byte        { return encodeIDList(TagIDs, ids) }
func DecodeIDs(b []byte) ([]atom.AtomID, error) { return decodeIDList(TagIDs, b) }

func EncodePull(ids []atom.AtomID) []byte        { return encodeIDList(TagPull, ids) }
func DecodePull(b []byte) ([]atom.AtomID, error) { return decodeIDList(TagPull, b) }

func EncodeAtoms(atoms []atom.Atom) []byte {
	var buf bytes.Buffer
	buf.WriteByte(TagAtoms)
	putU32(&buf, uint32(len(atoms)))
	for _, a := range atoms {
		body := atom.Marshal(a)
		putU32(&buf, uint32(len(body)))
		buf.Write(body)
	}
	return buf.Bytes()
}

func DecodeAtoms(b []byte) ([]atom.Atom, error) {
	if len(b) < 1 || b[0] != TagAtoms {
		return nil, fmt.Errorf("sync: not an ATOMS message")
	}
	if len(b) > MaxAtomsBodyBytes {
		return nil, fmt.Errorf("sync: ATOMS message %d bytes exceeds max %d", len(b), MaxAtomsBodyBytes)
	}
	r := &boundsReader{b: b, i: 1}
	n, err := r.u32()
	if err != nil {
		return nil, err
	}
	if n > MaxAtomsPerMessage {
		return nil, fmt.Errorf("sync: %d atoms exceeds max %d per message", n, MaxAtomsPerMessage)
	}
	out := make([]atom.Atom, 0, n)
	for i := uint32(0); i < n; i++ {
		bodyLen, err := r.u32()
		if err != nil {
			return nil, err
		}
		body, err := r.bytesN(bodyLen, atom.MaxEncodedBytes+4+64)
		if err != nil {
			return nil, err
		}
		a, err := atom.Unmarshal(body)
		if err != nil {
			return nil, fmt.Errorf("sync: atom %d: %w", i, err)
		}
		out = append(out, a)
	}
	return out, nil
}
