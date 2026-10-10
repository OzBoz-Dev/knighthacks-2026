package collector

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

type fakeClient struct {
	calls chan struct{}
	at    time.Time
	fail  bool
}

func (f *fakeClient) Fetch(context.Context) (vast.Result, error) {
	defer func() { f.calls <- struct{}{} }()
	if f.fail {
		return vast.Result{}, errors.New("vast: status 500")
	}
	return vast.Result{CapturedAt: f.at, Offers: []json.RawMessage{json.RawMessage(`{"id":1}`)}}, nil
}

func names(t *testing.T, dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, e := range entries {
		out = append(out, e.Name())
	}
	return out
}

func TestRun(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "snaps")
	f := &fakeClient{calls: make(chan struct{}), at: time.Date(2026, 10, 10, 20, 10, 0, 0, time.UTC)}
	ticks := make(chan time.Time)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { Run(ctx, f, dir, ticks); close(done) }()

	// Good run at start. The send returns when Run waits for a tick, after the file write.
	<-f.calls
	ticks <- time.Time{}
	got := names(t, dir)
	if len(got) != 1 || got[0] != "snapshot_20261010T201000Z.json" {
		t.Fatalf("files = %v", got)
	}
	b, _ := os.ReadFile(filepath.Join(dir, got[0]))
	var s snapshot
	if err := json.Unmarshal(b, &s); err != nil {
		t.Fatal(err)
	}
	if s.SnapshotID != "snap_20261010T201000Z" || s.CapturedAt != "2026-10-10T20:10:00Z" || len(s.Offers) != 1 || string(s.Offers[0]) != `{"id":1}` {
		t.Fatalf("file = %s", b)
	}

	// The tick starts a second good run. Wait for its fetch, then make the third run fail.
	<-f.calls
	f.fail = true
	f.at = f.at.Add(10 * time.Minute)
	ticks <- time.Time{}
	<-f.calls

	// Stop ends the goroutine. The failed run ended before Run returned.
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop")
	}
	if got := names(t, dir); len(got) != 1 {
		t.Fatalf("failed run left files: %v", got)
	}
}
