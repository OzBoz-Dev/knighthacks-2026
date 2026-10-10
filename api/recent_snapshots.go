package main

import (
	"context"
	"sync"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

// keptSnapshots covers about 15 minutes of the 60 second offer cache.
const keptSnapshots = 15

// recentSnapshots is the offer source that the handlers use. It keeps the offers of the last
// snapshots by ID, so a user can reserve an offer after the cache refreshes.
type recentSnapshots struct {
	src  vast.Source
	mu   sync.Mutex
	ids  []string // oldest first
	byID map[string]map[string]contract.Offer
	live bool // the last Get gave fresh offers, for the health endpoint
}

func newRecentSnapshots(src vast.Source) *recentSnapshots {
	return &recentSnapshots{src: src, byID: map[string]map[string]contract.Offer{}}
}

// Get returns the snapshot of src and keeps its offers.
func (s *recentSnapshots) Get(ctx context.Context) (vast.Snapshot, error) {
	snap, err := s.src.Get(ctx)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.live = err == nil && !snap.Saved
	if err != nil {
		return snap, err
	}
	id := vast.SnapshotID(snap.CapturedAt)
	if _, ok := s.byID[id]; !ok {
		offers := make(map[string]contract.Offer, len(snap.Offers))
		for _, o := range snap.Offers {
			offers[o.ID] = o
		}
		s.byID[id] = offers
		s.ids = append(s.ids, id)
		if len(s.ids) > keptSnapshots {
			delete(s.byID, s.ids[0])
			s.ids = s.ids[1:]
		}
	}
	return snap, nil
}

// Offer finds the offer in one of the kept snapshots.
func (s *recentSnapshots) Offer(snapshotID, offerID string) (contract.Offer, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.byID[snapshotID][offerID]
	return o, ok
}

// vastStatus gives the vast component status from the last Get, with no Vast.ai call.
// A call to the cache from here could store a timeout as a failed refresh for the whole TTL.
func (s *recentSnapshots) vastStatus() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.live {
		return statusOK
	}
	return statusUnavailable
}
