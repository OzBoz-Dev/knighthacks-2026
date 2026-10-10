package match

import (
	"testing"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

func ptr(v float64) *float64 { return &v }

func TestNormalize(t *testing.T) {
	cases := []struct {
		name   string
		offers []contract.Offer
		want   []contract.ScoreBreakdown
	}{
		{"none", nil, []contract.ScoreBreakdown{}},
		{"one offer gets 100", []contract.Offer{{PricePerHour: 1, Reliability: 0.9, DLPerf: ptr(10)}},
			[]contract.ScoreBreakdown{{Price: 100, Performance: 100, Reliability: 100}}},
		{"min-max with null dlperf", []contract.Offer{
			{PricePerHour: 1, Reliability: 0.9, DLPerf: ptr(10)},
			{PricePerHour: 2, Reliability: 1, DLPerf: ptr(30)},
			{PricePerHour: 3, Reliability: 0.95, DLPerf: nil},
		}, []contract.ScoreBreakdown{
			{Price: 100, Performance: 0, Reliability: 0},
			{Price: 50, Performance: 100, Reliability: 100},
			{Price: 0, Performance: 0, Reliability: 50},
		}},
		{"all equal gives 100, all null dlperf gives 0", []contract.Offer{
			{PricePerHour: 2, Reliability: 0.9}, {PricePerHour: 2, Reliability: 0.9},
		}, []contract.ScoreBreakdown{{Price: 100, Reliability: 100}, {Price: 100, Reliability: 100}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Normalize(tc.offers)
			if len(got) != len(tc.want) {
				t.Fatalf("got %d breakdowns, want %d", len(got), len(tc.want))
			}
			for i := range got {
				if !near(got[i].Price, tc.want[i].Price) || !near(got[i].Performance, tc.want[i].Performance) || !near(got[i].Reliability, tc.want[i].Reliability) {
					t.Errorf("offer %d: got %+v, want %+v", i, got[i], tc.want[i])
				}
			}
		})
	}
}

func near(a, b float64) bool { return a-b < 1e-9 && b-a < 1e-9 }
