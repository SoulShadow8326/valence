package lip

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
)

const maxCipherBytes = 16 * 1024

func EncodeFrame(f Frame) []byte {
	var buf bytes.Buffer
	buf.Write(f.SessionID[:])
	var ctr [4]byte
	binary.LittleEndian.PutUint32(ctr[:], f.Ctr)
	buf.Write(ctr[:])
	var l [4]byte
	binary.LittleEndian.PutUint32(l[:], uint32(len(f.Cipher)))
	buf.Write(l[:])
	buf.Write(f.Cipher)
	return buf.Bytes()
}

func DecodeFrame(b []byte) (Frame, error) {
	if len(b) < 32+4+4 {
		return Frame{}, io.ErrUnexpectedEOF
	}
	var f Frame
	copy(f.SessionID[:], b[:32])
	f.Ctr = binary.LittleEndian.Uint32(b[32:36])
	n := binary.LittleEndian.Uint32(b[36:40])
	if n > maxCipherBytes {
		return Frame{}, fmt.Errorf("lip: cipher length %d exceeds max %d", n, maxCipherBytes)
	}
	if len(b) != 40+int(n) {
		return Frame{}, fmt.Errorf("lip: frame length mismatch (declared %d, have %d)", n, len(b)-40)
	}
	f.Cipher = append([]byte{}, b[40:]...)
	return f, nil
}
