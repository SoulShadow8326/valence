package api

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"valence/node/engine"
	"valence/protocol/atom"
	"valence/protocol/bond"
)

type Server struct {
	Node *engine.Node
	mux  *http.ServeMux
}

func New(n *engine.Node) *Server {
	s := &Server{Node: n, mux: http.NewServeMux()}
	s.mux.HandleFunc("/graph", s.handleGraph)
	s.mux.HandleFunc("/publish", s.handlePublish)
	s.mux.HandleFunc("/identity", s.handleIdentity)
	s.mux.HandleFunc("/events", s.handleEvents)
	s.mux.HandleFunc("/lip/dial", s.handleLipDial)
	s.mux.HandleFunc("/lip/send", s.handleLipSend)
	s.mux.HandleFunc("/lip/events", s.handleLipEvents)
	s.mux.HandleFunc("/crystallize", s.handleCrystallize)
	return s
}

func (s *Server) ListenAndServe(addr string) error {
	return http.ListenAndServe(addr, withCORS(s.mux))
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			return
		}
		h.ServeHTTP(w, r)
	})
}

func mapSlice[T, U any](in []T, f func(T) U) []U {
	out := make([]U, len(in))
	for i, v := range in {
		out[i] = f(v)
	}
	return out
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

type atomDTO struct {
	ID      string            `json:"id"`
	Kind    string            `json:"kind"`
	Tags    []string          `json:"tags"`
	Payload map[string]string `json:"payload"`
	Refs    []string          `json:"refs"`
	PubKey  string            `json:"pubKey"`
	Seq     uint64            `json:"seq"`
}

func toAtomDTO(a atom.Atom) atomDTO {
	return atomDTO{
		ID:      atom.ID(a).String(),
		Kind:    string(a.Kind),
		Tags:    a.Tags,
		Payload: a.Payload,
		Refs:    mapSlice(a.Refs, atom.AtomID.String),
		PubKey:  hex.EncodeToString(a.PubKey),
		Seq:     a.Clock.Seq,
	}
}

type bondDTO struct {
	A        string  `json:"a"`
	B        string  `json:"b"`
	Type     string  `json:"type"`
	Strength float64 `json:"strength"`
}

func toBondDTO(b bond.Bond) bondDTO {
	return bondDTO{A: b.A.String(), B: b.B.String(), Type: b.Type.String(), Strength: b.Strength}
}

type moleculeDTO struct {
	ID        string   `json:"id"`
	Members   []string `json:"members"`
	Stability string   `json:"stability"`
}

func toMoleculeDTO(m bond.Molecule) moleculeDTO {
	return moleculeDTO{
		ID:        hex.EncodeToString(m.ID[:]),
		Members:   mapSlice(m.Members, atom.AtomID.String),
		Stability: m.Stability.String(),
	}
}

type graphDTO struct {
	Atoms     []atomDTO     `json:"atoms"`
	Bonds     []bondDTO     `json:"bonds"`
	Molecules []moleculeDTO `json:"molecules"`
	GraphHash string        `json:"graphHash"`
}

func (s *Server) handleGraph(w http.ResponseWriter, r *http.Request) {
	atoms, bonds, mols, hash := s.Node.Graph()
	writeJSON(w, graphDTO{
		Atoms:     mapSlice(atoms, toAtomDTO),
		Bonds:     mapSlice(bonds, toBondDTO),
		Molecules: mapSlice(mols, toMoleculeDTO),
		GraphHash: hex.EncodeToString(hash[:]),
	})
}

type publishReq struct {
	Kind    string            `json:"kind"`
	Tags    []string          `json:"tags"`
	Payload map[string]string `json:"payload"`
	Refs    []string          `json:"refs"`
}

func (s *Server) handlePublish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req publishReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	refs := make([]atom.AtomID, 0, len(req.Refs))
	for _, rs := range req.Refs {
		id, err := atom.ParseAtomID(rs)
		if err != nil {
			http.Error(w, fmt.Sprintf("bad ref %q: %v", rs, err), http.StatusBadRequest)
			return
		}
		refs = append(refs, id)
	}
	a, err := s.Node.Publish(atom.Kind(req.Kind), req.Tags, req.Payload, refs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, toAtomDTO(a))
}

func (s *Server) handleIdentity(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"pubKey": hex.EncodeToString(s.Node.Keys.Pub)})
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	var lastHash [32]byte
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			_, _, _, hash := s.Node.Graph()
			if hash != lastHash {
				lastHash = hash
				fmt.Fprintf(w, "event: graph\ndata: %s\n\n", hex.EncodeToString(hash[:]))
				flusher.Flush()
			}
		}
	}
}

type lipDialReq struct {
	Addr string `json:"addr"`
}

func (s *Server) handleLipDial(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req lipDialReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	sessionID, err := s.Node.Lip.Dial(req.Addr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, map[string]string{"sessionId": sessionID})
}

type lipSendReq struct {
	SessionID string `json:"sessionId"`
	Text      string `json:"text"`
}

func (s *Server) handleLipSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req lipSendReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.Node.Lip.Send(req.SessionID, []byte(req.Text)); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]bool{"ok": true})
}

func (s *Server) handleLipEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	for {
		select {
		case <-r.Context().Done():
			return
		case ev := <-s.Node.Lip.Incoming:
			payload, _ := json.Marshal(map[string]string{
				"sessionId": ev.SessionID,
				"peerId":    ev.PeerID,
				"text":      string(ev.Plaintext),
			})
			fmt.Fprintf(w, "event: frame\ndata: %s\n\n", payload)
			flusher.Flush()
		}
	}
}

func (s *Server) handleCrystallize(w http.ResponseWriter, r *http.Request) {
	s.handlePublish(w, r)
}
