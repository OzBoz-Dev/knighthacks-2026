package main

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

// clockSource returns a new snapshot each call, one minute after the last one.
type clockSource struct{ n int }

func (c *clockSource) Get(context.Context) (vast.Snapshot, error) {
	c.n++
	return vast.Snapshot{
		CapturedAt: time.Date(2026, 10, 10, 20, c.n, 0, 0, time.UTC),
		Offers:     []contract.Offer{{ID: "o1", GPUName: "RTX 4090", PricePerHour: float64(c.n)}},
	}, nil
}

func TestRecentSnapshots(t *testing.T) {
	r := newRecentSnapshots(&clockSource{})
	ctx := context.Background()
	for range keptSnapshots + 1 {
		if _, err := r.Get(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if _, ok := r.Offer("snap_20261010T200100Z", "o1"); ok {
		t.Fatal("the oldest snapshot must be dropped")
	}
	if o, ok := r.Offer("snap_20261010T200200Z", "o1"); !ok || o.PricePerHour != 2 {
		t.Fatalf("second snapshot: %v %+v", ok, o)
	}
	if o, ok := r.Offer("snap_20261010T201600Z", "o1"); !ok || o.PricePerHour != 16 {
		t.Fatalf("newest snapshot: %v %+v", ok, o)
	}
	if _, ok := r.Offer("snap_20261010T201600Z", "o2"); ok {
		t.Fatal("unknown offer must give false")
	}
	if len(r.ids) != keptSnapshots || len(r.byID) != keptSnapshots {
		t.Fatalf("kept %d ids and %d snapshots", len(r.ids), len(r.byID))
	}

	// The same snapshot again is kept once.
	same := newRecentSnapshots(stubSource{snap: vast.Snapshot{CapturedAt: time.Unix(0, 0)}})
	same.Get(ctx)
	same.Get(ctx)
	if len(same.ids) != 1 {
		t.Fatalf("ids = %v", same.ids)
	}

	if _, err := newRecentSnapshots(stubSource{err: errors.New("down")}).Get(ctx); err == nil {
		t.Fatal("want the source error")
	}
}
