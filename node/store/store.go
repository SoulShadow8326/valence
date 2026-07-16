package store

import (
	"sync"
	"time"

	"valence/protocol/atom"
)



type Store struct {
	mu        sync.RWMutex
	atoms     map[atom.AtomID]atom.Atom
	firstSeen map[atom.AtomID]time.Time
}

func New() *Store {
	return &Store{
		atoms:     make(map[atom.AtomID]atom.Atom),
		firstSeen: make(map[atom.AtomID]time.Time),
	}
}












func (s *Store) Put(a atom.Atom) error {
	id := atom.ID(a)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.atoms[id] = a
	if _, ok := s.firstSeen[id]; !ok {
		s.firstSeen[id] = time.Now()
	}
	return nil
}


func (s *Store) FirstSeen(id atom.AtomID) (time.Time, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.firstSeen[id]
	return t, ok
}

func (s *Store) Get(id atom.AtomID) (atom.Atom, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	a, ok := s.atoms[id]
	return a, ok
}

func (s *Store) All() []atom.Atom {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]atom.Atom, 0, len(s.atoms))
	for _, a := range s.atoms {
		out = append(out, a)
	}
	return out
}

func (s *Store) IDs() []atom.AtomID {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]atom.AtomID, 0, len(s.atoms))
	for id := range s.atoms {
		out = append(out, id)
	}
	return out
}






func (s *Store) Delete(id atom.AtomID) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.atoms, id)
	delete(s.firstSeen, id)
}

func (s *Store) Len() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.atoms)
}
