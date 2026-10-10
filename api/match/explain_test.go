package match

import (
	"slices"
	"testing"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

func TestExplain(t *testing.T) {
	a := contract.Offer{ID: "a", GPUName: "RTX 4090", GPURAMGB: 24, PricePerHour: 0.82, Reliability: 0.992, PerformancePerDollar: ptr(90)}
	b := contract.Offer{ID: "b", GPUName: "RTX 4090", GPURAMGB: 48, PricePerHour: 1.2, Reliability: 1, PerformancePerDollar: ptr(80)}
	req := contract.MatchRequest{MinVRAMGB: 20}
	recs := []contract.Recommendation{{Offer: a}, {Offer: b}}
	Explain(recs, []contract.Offer{a, b}, req, map[string]float64{"RTX 4090": 1})
	want := [][]string{
		{"24 GB VRAM per GPU meets your 20 GB requirement.", "$0.82/hour, 18% below the typical RTX 4090 price.", "99.2% reliability.", "Best performance-per-dollar among the suitable offers."},
		{"48 GB VRAM per GPU meets your 20 GB requirement.", "$1.20/hour, 20% above the typical RTX 4090 price.", "100% reliability."},
	}
	for i := range recs {
		if !slices.Equal(recs[i].Explanations, want[i]) {
			t.Errorf("rec %d: got %q, want %q", i, recs[i].Explanations, want[i])
		}
	}
	// No median: no price explanation, never an invented median.
	Explain(recs, []contract.Offer{a, b}, req, nil)
	if got := recs[1].Explanations; !slices.Equal(got, []string{"48 GB VRAM per GPU meets your 20 GB requirement.", "100% reliability."}) {
		t.Errorf("without median: got %q", got)
	}
}

func TestExplainRounding(t *testing.T) {
	o := contract.Offer{ID: "a", GPURAMGB: 24.04, Reliability: 0.9996}
	recs := []contract.Recommendation{{Offer: o}}
	Explain(recs, []contract.Offer{o}, contract.MatchRequest{MinVRAMGB: 23.96}, nil)
	want := []string{"24 GB VRAM per GPU meets your 24 GB requirement.", "99.9% reliability."}
	if !slices.Equal(recs[0].Explanations, want) {
		t.Errorf("got %q, want %q", recs[0].Explanations, want)
	}
}

func TestSuggest(t *testing.T) {
	req := contract.MatchRequest{MinVRAMGB: 24, MaxPricePerHour: 1, MinReliability: 0.95}
	cases := []struct {
		name   string
		offers []contract.Offer
		want   string
	}{
		{"no offers", nil, "No offers were available to check. Try again in a few minutes."},
		{"budget", []contract.Offer{
			{ID: "a", GPURAMGB: 24, Reliability: 1, PricePerHour: 1.5},
			{ID: "b", GPURAMGB: 24, Reliability: 1, PricePerHour: 1.2},
			{ID: "c", GPURAMGB: 8, Reliability: 1, PricePerHour: 0.5},
		}, "Budget excluded 2 offers; try raising it to $1.20/hour."},
		{"vram", []contract.Offer{
			{ID: "a", GPURAMGB: 16, Reliability: 1, PricePerHour: 0.5},
			{ID: "b", GPURAMGB: 20, Reliability: 0.5, PricePerHour: 0.5},
		}, "VRAM per GPU excluded 2 offers; try lowering it to 16 GB."},
		{"vram rounds down to one decimal", []contract.Offer{
			{ID: "a", GPURAMGB: 15.99, Reliability: 1, PricePerHour: 0.5},
		}, "VRAM per GPU excluded 1 offer; try lowering it to 15.9 GB."},
		{"reliability rounds down", []contract.Offer{
			{ID: "a", GPURAMGB: 24, Reliability: 0.9349, PricePerHour: 0.5},
		}, "Reliability excluded 1 offer; try lowering it to 93.4%."},
		{"equal counts take the filter order", []contract.Offer{
			{ID: "a", GPURAMGB: 8, Reliability: 1, PricePerHour: 0.5},
			{ID: "b", GPURAMGB: 24, Reliability: 1, PricePerHour: 3},
		}, "VRAM per GPU excluded 1 offer; try lowering it to 8 GB."},
		{"no offer fails only that filter", []contract.Offer{
			{ID: "a", GPURAMGB: 8, Reliability: 0.5, PricePerHour: 3},
		}, "VRAM per GPU excluded 1 offer; try loosening that filter."},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, ex := Filter(tc.offers, req)
			if got := Suggest(tc.offers, req, ex); got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
	model := []contract.Offer{{ID: "a", GPUName: "RTX 3090", Region: "EU", GPURAMGB: 24, Reliability: 1, PricePerHour: 0.5}}
	r := req
	r.GPUNames, r.Region = []string{"RTX 4090"}, "US"
	_, ex := Filter(model, r)
	if got := Suggest(model, r, ex); got != "GPU model excluded 1 offer; try loosening that filter." {
		t.Errorf("model: got %q", got)
	}
	r.Region = ""
	_, ex = Filter(model, r)
	if got := Suggest(model, r, ex); got != "GPU model excluded 1 offer; try adding the RTX 3090." {
		t.Errorf("model: got %q", got)
	}
}
