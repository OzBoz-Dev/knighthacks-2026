package vast

import (
	"encoding/json"
	"math"
	"testing"
)

func raw(s string) json.RawMessage { return json.RawMessage(s) }

func TestNormalizeMapping(t *testing.T) {
	tests := []struct {
		name                         string
		in                           string
		id, region                   string
		gb, total, ppd, relia, price float64 // ppd 0 means nil
		nilDLPerf                    bool
	}{
		{"single gpu", `{"id":1,"gpu_name":"RTX 4090","num_gpus":1,"gpu_ram":24564,"dph_total":0.5,"reliability2":0.99,"geolocation":"Texas, US","dlperf":50}`,
			"1", "US", 24, 24, 100, 0.99, 0.5, false},
		{"two gpus round", `{"id":5,"gpu_name":"RTX 4090","num_gpus":2,"gpu_ram":24564,"dph_total":1,"reliability2":0.9,"geolocation":"US","dlperf":1}`,
			"5", "US", 24, 48, 1, 0.9, 1, false},
		{"multi gpu total", `{"id":2,"gpu_name":"A100","num_gpus":4,"gpu_ram":40960,"dph_total":2,"reliability2":0.9,"geolocation":"DE","dlperf":10}`,
			"2", "DE", 40, 160, 5, 0.9, 2, false},
		{"null dlperf", `{"id":3,"gpu_name":"RTX 3090","num_gpus":1,"gpu_ram":24564,"dph_total":0.25,"reliability2":1,"geolocation":"Paris, Ile-de-France, FR","dlperf":null}`,
			"3", "FR", 24, 24, 0, 1, 0.25, true},
		{"old reliability name", `{"id":4,"gpu_name":"RTX 3090","num_gpus":2,"gpu_ram":12288,"dph_total":1,"reliability":0,"geolocation":"","dlperf":2}`,
			"4", "", 12, 24, 2, 0, 1, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, drops := Normalize([]json.RawMessage{raw(tt.in)})
			if len(got) != 1 || len(drops) != 0 {
				t.Fatalf("got %d offers, drops %v", len(got), drops)
			}
			o := got[0]
			if o.ID != tt.id || o.Region != tt.region || o.GPURAMGB != tt.gb || o.TotalVRAMGB != tt.total || o.Reliability != tt.relia || o.PricePerHour != tt.price {
				t.Errorf("offer = %+v", o)
			}
			if tt.nilDLPerf != (o.DLPerf == nil) || tt.nilDLPerf != (o.PerformancePerDollar == nil) {
				t.Errorf("dlperf = %v, ppd = %v", o.DLPerf, o.PerformancePerDollar)
			}
			if !tt.nilDLPerf && math.Abs(*o.PerformancePerDollar-tt.ppd) > 1e-9 {
				t.Errorf("ppd = %v, want %v", *o.PerformancePerDollar, tt.ppd)
			}
			if o.MarketPositionPct != nil || o.PricePercentile != nil {
				t.Error("market fields must stay nil")
			}
		})
	}
}

func TestNormalizeVerified(t *testing.T) {
	for in, want := range map[string]bool{"verified": true, "unverified": false, "deverified": false, "": false} {
		got, _ := Normalize([]json.RawMessage{raw(`{"id":1,"gpu_name":"RTX 4090","num_gpus":1,"gpu_ram":24564,"dph_total":0.5,"reliability2":0.99,"geolocation":"US","verified":null,"verification":"` + in + `"}`)})
		if len(got) != 1 || got[0].Verified != want {
			t.Errorf("verification %q: got %+v, want verified %v", in, got, want)
		}
	}
}

func TestNormalizeDrops(t *testing.T) {
	ok := `"gpu_name":"RTX 4090","num_gpus":1,"gpu_ram":24576,"dph_total":0.5,"reliability2":0.9`
	got, drops := Normalize([]json.RawMessage{
		raw(`{"id":1,` + ok + `}`),
		raw(`{"id":2,"gpu_name":" ","num_gpus":1,"dph_total":1,"reliability2":0.9}`),
		raw(`{"id":3,"gpu_name":"X","num_gpus":0,"dph_total":1,"reliability2":0.9}`),
		raw(`{"id":4,"gpu_name":"X","num_gpus":1,"dph_total":0,"reliability2":0.9}`),
		raw(`{"id":5,"gpu_name":"X","num_gpus":1,"dph_total":-1,"reliability2":0.9}`),
		raw(`{"id":6,"gpu_name":"X","num_gpus":1,"dph_total":1,"reliability2":1.5}`),
		raw(`{"id":7,"gpu_name":"X","num_gpus":1,"dph_total":1}`),
		raw(`{"id":8,"gpu_name":"X","num_gpus":1,"dph_total":1,"reliability2":-0.1}`),
		raw(`[1]`),
	})
	if len(got) != 1 || got[0].ID != "1" {
		t.Fatalf("kept = %+v", got)
	}
	want := map[string]int{DropNoGPUName: 1, DropBadGPUCount: 1, DropBadPrice: 2, DropBadReliability: 3, DropUnparseable: 1}
	for k, v := range want {
		if drops[k] != v {
			t.Errorf("drops[%s] = %d, want %d", k, drops[k], v)
		}
	}
	if len(drops) != len(want) {
		t.Errorf("drops = %v", drops)
	}
}
