package main

import (
	"flag"
	"fmt"
	"log"
	"path/filepath"

	"valence/node/api"
	"valence/node/engine"
	"valence/node/keystore"
	"valence/node/peer"
	"valence/node/store"
	"valence/node/transport"
)


func main() {
	dataDir := flag.String("data", "./data", "data directory for this node's identity")
	listenAddr := flag.String("listen", "0.0.0.0:0", "TCP listen address for peer sync")
	lipAddr := flag.String("lip", "0.0.0.0:0", "TCP listen address for LiP sessions")
	httpAddr := flag.String("http", "127.0.0.1:8080", "HTTP API bind address (loopback only)")
	flag.Parse()

	keyPath := filepath.Join(*dataDir, "identity.key")
	keys, err := keystore.LoadOrCreate(keyPath)
	if err != nil {
		log.Fatalf("keystore: %v", err)
	}
	fmt.Printf("identity: %x\n", keys.Pub)

	st := store.New()
	pt := peer.NewTable()

	tr, err := transport.NewMDNS(keys.Pub, *listenAddr)
	if err != nil {
		log.Fatalf("transport: %v", err)
	}
	defer tr.Close()

	n := engine.New(keys, st, pt, tr)
	n.Run()

	lipMgr, err := engine.NewLipManager(keys, *lipAddr)
	if err != nil {
		log.Fatalf("lip: %v", err)
	}
	n.Lip = lipMgr
	fmt.Printf("lip listening on %s\n", lipMgr.Addr())

	srv := api.New(n)
	fmt.Printf("http api listening on %s\n", *httpAddr)
	log.Fatal(srv.ListenAndServe(*httpAddr))
}
