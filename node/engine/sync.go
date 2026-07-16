package engine

import (
	"io"

	"valence/node/store"
	"valence/protocol/atom"
	psync "valence/protocol/sync"
)




func runInitiator(conn io.ReadWriter, st *store.Store) (pulled, pushed int, err error) {
	myIDs := st.IDs()
	digest := psync.BuildDigest(myIDs)
	if err = writeFrame(conn, psync.EncodeDigest(digest)); err != nil {
		return
	}

	wantBytes, err := readFrame(conn)
	if err != nil {
		return
	}
	buckets, err := psync.DecodeWant(wantBytes)
	if err != nil {
		return
	}

	myBucketIDs := psync.BucketIDs(myIDs, buckets)
	if err = writeFrame(conn, psync.EncodeIDs(myBucketIDs)); err != nil {
		return
	}

	pullBytes, err := readFrame(conn)
	if err != nil {
		return
	}
	wanted, err := psync.DecodePull(pullBytes)
	if err != nil {
		return
	}

	var toSend []atom.Atom
	for _, id := range wanted {
		if a, ok := st.Get(id); ok {
			toSend = append(toSend, a)
		}
	}
	if err = sendAtomsBatched(conn, toSend); err != nil {
		return
	}
	pushed = len(toSend)

	pulled, err = recvAtomsBatched(conn, st)
	return
}





func runResponder(conn io.ReadWriter, st *store.Store) (pulled, pushed int, err error) {
	digestBytes, err := readFrame(conn)
	if err != nil {
		return
	}
	remoteDigest, err := psync.DecodeDigest(digestBytes)
	if err != nil {
		return
	}

	myIDs := st.IDs()
	myDigest := psync.BuildDigest(myIDs)
	buckets := psync.MismatchedBuckets(myDigest, remoteDigest)

	if err = writeFrame(conn, psync.EncodeWant(buckets)); err != nil {
		return
	}

	idsBytes, err := readFrame(conn)
	if err != nil {
		return
	}
	remoteBucketIDs, err := psync.DecodeIDs(idsBytes)
	if err != nil {
		return
	}

	myBucketIDs := psync.BucketIDs(myIDs, buckets)
	bWants := psync.Missing(myBucketIDs, remoteBucketIDs)
	aWants := psync.Missing(remoteBucketIDs, myBucketIDs)

	if err = writeFrame(conn, psync.EncodePull(bWants)); err != nil {
		return
	}

	pulled, err = recvAtomsBatched(conn, st)
	if err != nil {
		return
	}

	var toPush []atom.Atom
	for _, id := range aWants {
		if a, ok := st.Get(id); ok {
			toPush = append(toPush, a)
		}
	}
	err = sendAtomsBatched(conn, toPush)
	pushed = len(toPush)
	return
}




func sendAtomsBatched(w io.Writer, atoms []atom.Atom) error {
	for i := 0; i < len(atoms); i += psync.MaxAtomsPerMessage {
		end := i + psync.MaxAtomsPerMessage
		if end > len(atoms) {
			end = len(atoms)
		}
		if err := writeFrame(w, psync.EncodeAtoms(atoms[i:end])); err != nil {
			return err
		}
	}
	return writeFrame(w, psync.EncodeAtoms(nil))
}





func recvAtomsBatched(r io.Reader, st *store.Store) (int, error) {
	total := 0
	for {
		b, err := readFrame(r)
		if err != nil {
			return total, err
		}
		atoms, err := psync.DecodeAtoms(b)
		if err != nil {
			return total, err
		}
		if len(atoms) == 0 {
			return total, nil
		}
		for _, a := range atoms {
			if verr := atom.Verify(a); verr != nil {
				continue
			}
			st.Put(a)
			total++
		}
	}
}
