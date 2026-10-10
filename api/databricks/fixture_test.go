package databricks

import (
	"os"
	"path/filepath"
	"testing"
)

const exportJSON = `{"exported_at":"2026-10-10T17:00:00Z","snapshot_id":null,
"summaries":[{"gpu_name":"RTX 4090","listing_count":212,"lowest_price":0.29,"median_price":0.48,"p90_price":0.71,"median_reliability":0.981,"updated_at":"2026-10-10T16:50:00Z"}],
"trends":[
{"gpu_name":"RTX 4090","region":"US","timestamp":"2026-10-10T16:50:00Z","minimum_price":0.3,"median_price":0.49,"p10_price":0.33,"p90_price":0.7,"listing_count":204},
{"gpu_name":"RTX 4090","region":"US","timestamp":"2026-10-10T16:40:00Z","minimum_price":0.3,"median_price":0.48,"p10_price":0.32,"p90_price":0.7,"listing_count":200},
{"gpu_name":"RTX 4090","region":"all","timestamp":"2026-10-10T16:45:00Z","minimum_price":0.3,"median_price":0.5,"p10_price":0.32,"p90_price":0.8,"listing_count":224},
{"gpu_name":"RTX 4090","region":"EU","timestamp":"2026-10-10T16:45:00Z","minimum_price":0.4,"median_price":0.5,"p10_price":0.41,"p90_price":0.8,"listing_count":20}]}`

func TestLoadExport(t *testing.T) {
	path := filepath.Join(t.TempDir(), "databricks_market.json")
	os.WriteFile(path, []byte(exportJSON), 0o600)
	e, err := LoadExport(path)
	if err != nil {
		t.Fatal(err)
	}
	if e.ExportedAt != "2026-10-10T17:00:00Z" || e.SnapshotID != nil {
		t.Fatalf("export = %+v", e)
	}
	if s := e.Summary("RTX 4090"); s == nil || s.ListingCount != 212 {
		t.Fatalf("summary = %v", s)
	}
	if m := e.Medians(); len(m) != 1 || m["RTX 4090"] != 0.48 {
		t.Fatalf("medians = %v", m)
	}
	if e.Summary("rtx 4090") != nil || e.Summary("A100") != nil {
		t.Fatal("unknown GPU must give nil")
	}
	us := e.TrendPoints("RTX 4090", "US")
	if len(us) != 2 || us[0].Timestamp != "2026-10-10T16:40:00Z" || us[0].P10Price != 0.32 {
		t.Fatalf("US points = %+v", us)
	}
	if all := e.TrendPoints("RTX 4090", ""); len(all) != 1 || all[0].ListingCount != 224 {
		t.Fatalf("all points = %+v", all)
	}
	if len(e.TrendPoints("rtx 4090", "us")) != 0 || len(e.TrendPoints("A100", "")) != 0 {
		t.Fatal("unknown GPU must give no points")
	}
}

func TestLoadExportErrors(t *testing.T) {
	if _, err := LoadExport(filepath.Join(t.TempDir(), "missing.json")); err == nil {
		t.Fatal("want error for a missing file")
	}
	path := filepath.Join(t.TempDir(), "bad.json")
	os.WriteFile(path, []byte(`{"exported_at":"yesterday"}`), 0o600)
	if _, err := LoadExport(path); err == nil {
		t.Fatal("want error for a bad exported_at")
	}
}
