package engine

import (
	"encoding/binary"
	"fmt"
	"io"
)

const maxFrameBytes = 128 * 1024

func writeFrame(w io.Writer, payload []byte) error {
	var l [4]byte
	binary.LittleEndian.PutUint32(l[:], uint32(len(payload)))
	if _, err := w.Write(l[:]); err != nil {
		return err
	}
	_, err := w.Write(payload)
	return err
}

func readFrame(r io.Reader) ([]byte, error) {
	var l [4]byte
	if _, err := io.ReadFull(r, l[:]); err != nil {
		return nil, err
	}
	n := binary.LittleEndian.Uint32(l[:])
	if n > maxFrameBytes {
		return nil, fmt.Errorf("engine: frame length %d exceeds max %d", n, maxFrameBytes)
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, err
	}
	return buf, nil
}
