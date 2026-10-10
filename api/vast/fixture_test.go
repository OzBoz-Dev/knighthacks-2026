package vast

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadFixture(t *testing.T) {
	path := filepath.Join(t.TempDir(), "vast_offers.json")
	body := `{"source":"vast-saved","captured_at":"2026-10-10T20:10:00Z","snapshot_id":"snap_20261010T201000Z","data":[{"id":"7","gpu_name":"RTX 4090","num_gpus":1,"gpu_ram_gb":24,"total_vram_gb":24,"region":"US","price_per_hour":0.4,"reliability":0.99,"dlperf":null,"performance_per_dollar":null,"verified":true,"market_position_pct":null,"price_percentile":null}]}`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	snap, err := LoadFixture(path)
	if err != nil {
		t.Fatal(err)
	}
	got, _ := Source(snap).Get(context.Background())
	if !got.Saved || !got.CapturedAt.Equal(time.Date(2026, 10, 10, 20, 10, 0, 0, time.UTC)) || len(got.Offers) != 1 || got.Offers[0].ID != "7" {
		t.Fatalf("snapshot = %+v", got)
	}
}

func TestLoadFixtureErrors(t *testing.T) {
	dir := t.TempDir()
	if _, err := LoadFixture(filepath.Join(dir, "missing.json")); err == nil {
		t.Error("want an error for a missing file")
	}
	bad := filepath.Join(dir, "bad.json")
	os.WriteFile(bad, []byte(`{"captured_at":"yesterday","data":[]}`), 0o600)
	if _, err := LoadFixture(bad); err == nil {
		t.Error("want an error for a bad time")
	}
}
