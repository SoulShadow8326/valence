package transport

import (
	"context"
	"encoding/base64"
	"net"
	"strconv"

	"github.com/grandcat/zeroconf"
)

const (
	serviceType = "_valence._tcp"
	domain      = "local."
)

type MDNS struct {
	selfPubB64 string

	listener net.Listener
	server   *zeroconf.Server
	resolver *zeroconf.Resolver

	accept  chan net.Conn
	adverts chan Advert
	cancel  context.CancelFunc
}

func NewMDNS(pubKey []byte, listenAddr string) (*MDNS, error) {
	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return nil, err
	}
	port := ln.Addr().(*net.TCPAddr).Port

	pkB64 := base64.StdEncoding.EncodeToString(pubKey)
	instance := "valence-" + pkB64[:12]

	server, err := zeroconf.RegisterProxy(instance, serviceType, domain, port, instance+".local.", []string{"127.0.0.1"}, []string{"id=" + pkB64, "v=1"}, nil)
	if err != nil {
		ln.Close()
		return nil, err
	}

	resolver, err := zeroconf.NewResolver(nil)
	if err != nil {
		server.Shutdown()
		ln.Close()
		return nil, err
	}

	m := &MDNS{
		selfPubB64: pkB64,
		listener:   ln,
		server:     server,
		resolver:   resolver,
		accept:     make(chan net.Conn, 8),
		adverts:    make(chan Advert, 32),
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel

	go m.acceptLoop()
	go m.browseLoop(ctx)

	return m, nil
}

func (m *MDNS) Name() string { return "mdns-tcp" }

func (m *MDNS) Dial(addr string) (net.Conn, error) { return net.Dial("tcp", addr) }

func (m *MDNS) Accept() <-chan net.Conn { return m.accept }

func (m *MDNS) Discovered() <-chan Advert { return m.adverts }

func (m *MDNS) Close() error {
	m.cancel()
	m.server.Shutdown()
	return m.listener.Close()
}

func (m *MDNS) acceptLoop() {
	for {
		conn, err := m.listener.Accept()
		if err != nil {
			return
		}
		select {
		case m.accept <- conn:
		default:
			conn.Close()
		}
	}
}

func (m *MDNS) browseLoop(ctx context.Context) {
	entries := make(chan *zeroconf.ServiceEntry, 32)
	go func() {
		for entry := range entries {
			pk := extractPubKey(entry.Text)
			if pk == nil || base64.StdEncoding.EncodeToString(pk) == m.selfPubB64 {
				continue
			}
			for _, ip := range entry.AddrIPv4 {
				addr := net.JoinHostPort(ip.String(), strconv.Itoa(entry.Port))
				select {
				case m.adverts <- Advert{Addr: addr, PubKey: pk}:
				default:
				}
			}
		}
	}()

	_ = m.resolver.Browse(ctx, serviceType, domain, entries)
	<-ctx.Done()
}

func extractPubKey(txt []string) []byte {
	for _, t := range txt {
		if len(t) > 3 && t[:3] == "id=" {
			if pk, err := base64.StdEncoding.DecodeString(t[3:]); err == nil {
				return pk
			}
		}
	}
	return nil
}
