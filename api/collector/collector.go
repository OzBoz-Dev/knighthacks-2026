// Package collector writes a raw Vast.ai snapshot file on each tick.
package collector

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

// Fetcher is the part of vast.Client that the collector uses.
type Fetcher interface {
	Fetch(ctx context.Context) (vast.Result, error)
}

type snapshot struct {
	SnapshotID string            `json:"snapshot_id"`
	CapturedAt string            `json:"captured_at"`
	Offers     []json.RawMessage `json:"offers"`
}

// Run writes one snapshot at start, then one on each tick. It returns when ctx ends.
func Run(ctx context.Context, f Fetcher, dir string, ticks <-chan time.Time) {
	for {
		collect(ctx, f, dir)
		select {
		case <-ctx.Done():
			return
		case <-ticks:
		}
	}
}

func collect(ctx context.Context, f Fetcher, dir string) {
	res, err := f.Fetch(ctx)
	if err != nil {
		slog.Warn("collector fetch failed", "err", err)
		return
	}
	b, err := json.Marshal(snapshot{
		SnapshotID: vast.SnapshotID(res.CapturedAt),
		CapturedAt: res.CapturedAt.UTC().Format(time.RFC3339),
		Offers:     res.Offers,
	})
	if err != nil {
		slog.Warn("collector encode failed", "err", err)
		return
	}
	name := filepath.Join(dir, "snapshot_"+res.CapturedAt.UTC().Format("20060102T150405Z")+".json")
	if err := writeAtomic(dir, name, b); err != nil {
		slog.Warn("collector write failed", "err", err)
	}
}

// writeAtomic writes to a temp file in dir, then renames it, so a reader never sees a partial file.
// The temp name does not match snapshot_*.json.
func writeAtomic(dir, name string, b []byte) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".snapshot_*.tmp")
	if err != nil {
		return err
	}
	err = tmp.Chmod(0o644) // CreateTemp uses 0600, and the upload script may run as another user
	if err == nil {
		_, err = tmp.Write(b)
	}
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err == nil {
		err = os.Rename(tmp.Name(), name)
	}
	if err != nil {
		os.Remove(tmp.Name())
	}
	return err
}
