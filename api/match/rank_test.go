package match

import (
	"testing"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

func TestWeightsSumToOne(t *testing.T) {
	for p, w := range weights {
		if !near(w.Price+w.Performance+w.Reliability, 1) {
			t.Errorf("%s weights sum to %v", p, w.Price+w.Performance+w.Reliability)
		}
	}
}

func TestRankRejectsUnknownPriority(t *testing.T) {
	if _, err := Rank(nil, "fastest"); err == nil {
		t.Fatal("want an error for an unknown priority")
	}
}

func TestRankTopFiveWithTieBreak(t *testing.T) {
	var offers []contract.Offer
	for _, id := range []string{"g", "f", "e", "d", "c", "b", "a"} {
		offers = append(offers, contract.Offer{ID: id, PricePerHour: 1, Reliability: 0.99, DLPerf: ptr(10)})
	}
	recs, err := Rank(offers, contract.PriorityBalanced)
	if err != nil {
		t.Fatal(err)
	}
	var got string
	for i, r := range recs {
		if r.Rank != i+1 || r.Score != 100 {
			t.Errorf("rec %d: rank %d, score %v", i, r.Rank, r.Score)
		}
		got += r.Offer.ID
	}
	if got != "abcde" {
		t.Fatalf("order = %q, want abcde", got)
	}
}
