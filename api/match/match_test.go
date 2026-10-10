package match

import (
	"reflect"
	"slices"
	"testing"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// offer builds an offer that passes the model, region, and VRAM filters of baseReq.
func offer(id string, price, rel float64, dlperf *float64) contract.Offer {
	return contract.Offer{ID: id, GPUName: "RTX 4090", Region: "US", GPURAMGB: 24, PricePerHour: price, Reliability: rel, DLPerf: dlperf}
}

func baseReq(p contract.Priority) contract.MatchRequest {
	return contract.MatchRequest{MinVRAMGB: 24, MaxPricePerHour: 2, MinReliability: 0.5, Priority: p, GPUNames: []string{"RTX 4090"}, Region: "US"}
}

// snapshot holds seven eligible offers and six excluded offers. The values are exact in binary,
// so the expected scores below are exact. a and d are twins, so only the offer ID orders them.
func snapshot() []contract.Offer {
	model := offer("h", 1, 1, nil)
	model.GPUName, model.GPURAMGB = "RTX 3090", 8
	region := offer("i", 1, 0.1, nil)
	region.Region = "EU"
	vram := offer("j", 1, 1, nil)
	vram.GPURAMGB = 16
	return []contract.Offer{
		offer("a", 1.0, 0.5, ptr(40)),
		offer("b", 2.0, 1.0, ptr(100)),
		offer("c", 1.5, 1.0, nil),
		offer("d", 1.0, 0.5, ptr(40)),
		offer("e", 1.25, 1.0, ptr(70)),
		offer("f", 1.75, 0.75, ptr(100)),
		offer("g", 2.0, 0.5, ptr(40)),
		model, region, vram,
		offer("k", 3, 0.4, nil),
		offer("l", 2.5, 1, nil),
		offer("m", 3, 1, nil),
	}
}

func ids(recs []contract.Recommendation) []string {
	out := []string{}
	for _, r := range recs {
		out = append(out, r.Offer.ID)
	}
	return out
}

func TestRunOrderIsDeterministicForEachPriority(t *testing.T) {
	// Scores: cheapest e75 a60 d60 c50 f45 b40 g0, balanced e72.5 b60 f57.5 c45 a40 d40 g0,
	// performance b80 f75 e65 c30 a20 d20 g0.
	cases := []struct {
		priority contract.Priority
		want     []string
		scores   []float64
	}{
		{contract.PriorityCheapest, []string{"e", "a", "d", "c", "f"}, []float64{75, 60, 60, 50, 45}},
		{contract.PriorityBalanced, []string{"e", "b", "f", "c", "a"}, []float64{72.5, 60, 57.5, 45, 40}},
		{contract.PriorityPerformance, []string{"b", "f", "e", "c", "a"}, []float64{80, 75, 65, 30, 20}},
	}
	for _, tc := range cases {
		t.Run(string(tc.priority), func(t *testing.T) {
			first, _, err := Run(snapshot(), baseReq(tc.priority), nil)
			if err != nil {
				t.Fatal(err)
			}
			if got := ids(first.Recommendations); !slices.Equal(got, tc.want) {
				t.Fatalf("order = %v, want %v", got, tc.want)
			}
			for i, r := range first.Recommendations {
				if r.Rank != i+1 || r.Score != tc.scores[i] {
					t.Errorf("rec %s: rank %d score %v, want rank %d score %v", r.Offer.ID, r.Rank, r.Score, i+1, tc.scores[i])
				}
			}
			// The input order and a second run must not change the result.
			reversed := snapshot()
			slices.Reverse(reversed)
			rotated := snapshot()
			rotated = append(rotated[5:], rotated[:5]...)
			for _, in := range [][]contract.Offer{snapshot(), reversed, rotated} {
				got, _, _ := Run(in, baseReq(tc.priority), nil)
				if !reflect.DeepEqual(got, first) {
					t.Fatalf("a run with reordered input gave %v, want %v", ids(got.Recommendations), tc.want)
				}
			}
		})
	}
}

func TestRunTieBreaks(t *testing.T) {
	cases := []struct {
		name     string
		priority contract.Priority
		offers   []contract.Offer
		want     []string
	}{
		// z: 20+60+0, a: 0+60+20. The scores are equal, so the lower price goes first.
		{"lower price", contract.PriorityPerformance,
			[]contract.Offer{offer("a", 2, 1, ptr(50)), offer("z", 1, 0.5, ptr(50))}, []string{"z", "a"}},
		// a: 60+20+0, z: 60+0+20. Price and score are equal, so the higher reliability goes first.
		{"higher reliability", contract.PriorityCheapest,
			[]contract.Offer{offer("a", 1, 0.5, ptr(100)), offer("z", 1, 1, ptr(50))}, []string{"z", "a"}},
		// b: 20+15+25 and c: 0+35+25 both show 60. The sort must use the shown score, not float noise.
		{"lower price at a shown tie", contract.PriorityBalanced,
			[]contract.Offer{offer("c", 0.60, 0.95, ptr(17)), offer("b", 0.45, 0.95, ptr(13)), offer("a", 0.30, 0.95, ptr(10))}, []string{"a", "b", "c"}},
		{"offer id", contract.PriorityBalanced,
			[]contract.Offer{offer("b", 1, 1, ptr(10)), offer("c", 1, 1, ptr(10)), offer("a", 1, 1, ptr(10))}, []string{"a", "b", "c"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, _, err := Run(tc.offers, baseReq(tc.priority), nil)
			if err != nil {
				t.Fatal(err)
			}
			if r := got.Recommendations; r[len(r)-2].Score != r[len(r)-1].Score {
				t.Fatalf("the last two offers must tie: scores %v and %v", r[len(r)-2].Score, r[len(r)-1].Score)
			}
			if ids := ids(got.Recommendations); !slices.Equal(ids, tc.want) {
				t.Fatalf("order = %v, want %v", ids, tc.want)
			}
		})
	}
}

func TestRunEligibleCounts(t *testing.T) {
	cases := []struct {
		name           string
		offers         []contract.Offer
		checked, elig  int
		excluded       contract.Excluded
		recs           int
		wantSuggestion bool
	}{
		{"empty snapshot", nil, 0, 0, contract.Excluded{}, 0, true},
		{"zero eligible", snapshot()[7:], 6, 0, contract.Excluded{GPUModel: 1, Region: 1, VRAM: 1, Reliability: 1, Budget: 2}, 0, true},
		{"one eligible", snapshot()[:1], 1, 1, contract.Excluded{}, 1, false},
		{"many eligible", snapshot(), 13, 7, contract.Excluded{GPUModel: 1, Region: 1, VRAM: 1, Reliability: 1, Budget: 2}, 5, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, suggestion, err := Run(tc.offers, baseReq(contract.PriorityBalanced), nil)
			if err != nil {
				t.Fatal(err)
			}
			if got.Checked != tc.checked || got.Eligible != tc.elig || got.Excluded != tc.excluded {
				t.Fatalf("checked %d eligible %d excluded %+v, want %d %d %+v", got.Checked, got.Eligible, got.Excluded, tc.checked, tc.elig, tc.excluded)
			}
			ex := got.Excluded
			if got.Checked != got.Eligible+ex.GPUModel+ex.Region+ex.VRAM+ex.Reliability+ex.Budget {
				t.Fatal("checked must equal eligible plus the exclusion counts")
			}
			if got.Recommendations == nil || len(got.Recommendations) != tc.recs {
				t.Fatalf("got %d recommendations, want %d (never nil)", len(got.Recommendations), tc.recs)
			}
			if (suggestion != "") != tc.wantSuggestion {
				t.Fatalf("suggestion = %q", suggestion)
			}
			for _, r := range got.Recommendations {
				if n := len(r.Explanations); n < 2 || n > 4 {
					t.Errorf("offer %s has %d explanations", r.Offer.ID, n)
				}
			}
		})
	}
}

func TestRunOneEligibleScores(t *testing.T) {
	cases := []struct {
		name   string
		dlperf *float64
		want   contract.ScoreBreakdown
		score  float64
	}{
		{"with dlperf", ptr(10), contract.ScoreBreakdown{Price: 100, Performance: 100, Reliability: 100}, 100},
		{"null dlperf scores 0", nil, contract.ScoreBreakdown{Price: 100, Performance: 0, Reliability: 100}, 65},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, _, _ := Run([]contract.Offer{offer("a", 1, 0.9, tc.dlperf)}, baseReq(contract.PriorityBalanced), nil)
			r := got.Recommendations[0]
			if r.Rank != 1 || r.ScoreBreakdown != tc.want || r.Score != tc.score {
				t.Fatalf("got rank %d score %v breakdown %+v", r.Rank, r.Score, r.ScoreBreakdown)
			}
		})
	}
}

func TestRunNullDLPerfAmongMany(t *testing.T) {
	got, _, _ := Run(snapshot(), baseReq(contract.PriorityBalanced), nil)
	for _, r := range got.Recommendations {
		if r.Offer.ID == "c" && r.ScoreBreakdown.Performance != 0 {
			t.Fatalf("null dlperf scored %v, want 0", r.ScoreBreakdown.Performance)
		}
	}
}

func TestRunUnknownPriority(t *testing.T) {
	if _, _, err := Run(snapshot(), baseReq("fastest"), nil); err == nil {
		t.Fatal("want an error for an unknown priority")
	}
}
