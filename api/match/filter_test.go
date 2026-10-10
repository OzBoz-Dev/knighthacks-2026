package match

import (
	"testing"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

func TestFilterCountsTheFirstReasonOnly(t *testing.T) {
	req := contract.MatchRequest{MinVRAMGB: 24, MaxPricePerHour: 1, MinReliability: 0.95, GPUNames: []string{"RTX 4090"}, Region: "US"}
	offers := []contract.Offer{
		{ID: "ok", GPUName: "RTX 4090", Region: "US", GPURAMGB: 24, Reliability: 0.95, PricePerHour: 1},
		{ID: "model", GPUName: "RTX 3090", Region: "EU", GPURAMGB: 8, Reliability: 0.5, PricePerHour: 9},
		{ID: "region", GPUName: "RTX 4090", Region: "EU", GPURAMGB: 8, Reliability: 0.5, PricePerHour: 9},
		{ID: "vram", GPUName: "RTX 4090", Region: "US", GPURAMGB: 23.9, Reliability: 0.5, PricePerHour: 9},
		{ID: "rel", GPUName: "RTX 4090", Region: "US", GPURAMGB: 48, Reliability: 0.949, PricePerHour: 9},
		{ID: "budget", GPUName: "RTX 4090", Region: "US", GPURAMGB: 48, Reliability: 1, PricePerHour: 1.01},
	}
	eligible, ex := Filter(offers, req)
	if len(eligible) != 1 || eligible[0].ID != "ok" {
		t.Fatalf("eligible = %+v, want only ok", eligible)
	}
	want := contract.Excluded{GPUModel: 1, Region: 1, VRAM: 1, Reliability: 1, Budget: 1}
	if ex != want {
		t.Fatalf("excluded = %+v, want %+v", ex, want)
	}
}

// Issue #36: VRAM is compared per GPU. Two 12 GB cards are 24 GB total but 12 GB per GPU.
func TestFilterVRAMIsPerGPU(t *testing.T) {
	req := contract.MatchRequest{MinVRAMGB: 24, MaxPricePerHour: 1, MinReliability: 0.5}
	offers := []contract.Offer{
		{ID: "two", NumGPUs: 2, GPURAMGB: 12, TotalVRAMGB: 24, Reliability: 1, PricePerHour: 0.5},
		{ID: "one", NumGPUs: 1, GPURAMGB: 24, TotalVRAMGB: 24, Reliability: 1, PricePerHour: 0.5},
	}
	eligible, ex := Filter(offers, req)
	if len(eligible) != 1 || eligible[0].ID != "one" || ex != (contract.Excluded{VRAM: 1}) {
		t.Fatalf("eligible = %+v, excluded = %+v, want only one with VRAM 1 excluded", eligible, ex)
	}
}

func TestFilterSkipsUnsetModelAndRegion(t *testing.T) {
	offers := []contract.Offer{{ID: "a", GPUName: "A100", Region: "EU", GPURAMGB: 80, Reliability: 1, PricePerHour: 2}}
	eligible, ex := Filter(offers, contract.MatchRequest{MinVRAMGB: 80, MaxPricePerHour: 2, MinReliability: 1})
	if len(eligible) != 1 || ex != (contract.Excluded{}) {
		t.Fatalf("eligible = %+v, excluded = %+v", eligible, ex)
	}
}
