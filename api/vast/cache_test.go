package vast

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

type fakeFetcher struct {
	calls int
	fail  bool
	at    time.Time
}

func (f *fakeFetcher) Fetch(context.Context) (Result, error) {
	f.calls++
	if f.fail {
		return Result{}, errors.New("vast: status 500")
	}
	return Result{CapturedAt: f.at, Offers: []json.RawMessage{
		json.RawMessage(`{"id":1,"gpu_name":"RTX 4090","num_gpus":1,"gpu_ram":24576,"dph_total":0.5,"reliability2":0.9}`),
	}}, nil
}

func TestCache(t *testing.T) {
	clock := time.Date(2026, 10, 10, 20, 0, 0, 0, time.UTC)
	f := &fakeFetcher{at: clock}
	c := NewCache(f, 60*time.Second, func() time.Time { return clock })
	ctx := context.Background()

	if _, err := c.Get(ctx); err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(59 * time.Second)
	got, _ := c.Get(ctx)
	if f.calls != 1 || got.Saved || len(got.Offers) != 1 {
		t.Fatalf("calls = %d, snapshot = %+v", f.calls, got)
	}

	clock = clock.Add(2 * time.Second) // 61 s after the first call
	f.fail = true
	got, err := c.Get(ctx)
	if err != nil || f.calls != 2 || !got.Saved || !got.CapturedAt.Equal(f.at) || len(got.Offers) != 1 {
		t.Fatalf("err = %v, calls = %d, snapshot = %+v", err, f.calls, got)
	}

	clock = clock.Add(30 * time.Second) // inside the TTL after the failure
	got, _ = c.Get(ctx)
	if f.calls != 2 || !got.Saved || !got.CapturedAt.Equal(f.at) {
		t.Fatalf("retried inside the TTL: calls = %d, snapshot = %+v", f.calls, got)
	}

	clock = clock.Add(31 * time.Second)
	f.fail = false
	f.at = clock
	got, _ = c.Get(ctx)
	if got.Saved || !got.CapturedAt.Equal(clock) {
		t.Fatalf("snapshot = %+v", got)
	}
}

func TestCacheDrops(t *testing.T) {
	c := NewCache(&fakeFetcher{at: time.Now()}, time.Minute, time.Now)
	c.Get(context.Background())
	if d := c.Drops(); len(d) != 0 {
		t.Fatalf("drops = %v", d)
	}
}

func TestCacheNoDataYet(t *testing.T) {
	c := NewCache(&fakeFetcher{fail: true}, time.Minute, time.Now)
	if _, err := c.Get(context.Background()); err == nil {
		t.Fatal("want an error")
	}
}
