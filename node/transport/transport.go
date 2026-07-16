package transport

import "net"

type Advert struct {
	Addr   string
	PubKey []byte
}

type Transport interface {
	Name() string
	Dial(addr string) (net.Conn, error)
	Accept() <-chan net.Conn
	Discovered() <-chan Advert
	Close() error
}
