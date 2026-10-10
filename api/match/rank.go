package match

import (
	"cmp"
	"fmt"
	"math"
	"slices"
	"strings"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// weights holds the factor weights for each priority, from the prd.md section 5.2 table.
var weights = map[contract.Priority]contract.ScoreBreakdown{
	contract.PriorityCheapest:    {Price: 0.60, Performance: 0.20, Reliability: 0.20},
	contract.PriorityBalanced:    {Price: 0.40, Performance: 0.35, Reliability: 0.25},
	contract.PriorityPerformance: {Price: 0.20, Performance: 0.60, Reliability: 0.20},
}

const topN = 5

// Rank scores the eligible offers and returns the top five with ranks from 1.
// The score is rounded to two decimals before the sort. The output rounds the breakdown to two decimals.
func Rank(eligible []contract.Offer, priority contract.Priority) ([]contract.Recommendation, error) {
	w, ok := weights[priority]
	if !ok {
		return nil, fmt.Errorf("unknown priority %q", priority)
	}
	type item struct {
		offer contract.Offer
		parts contract.ScoreBreakdown
		score float64
	}
	parts := Normalize(eligible)
	items := make([]item, len(eligible))
	for i, o := range eligible {
		p := parts[i]
		// Round before the sort, so offers that show the same score tie and use the tie-break.
		items[i] = item{o, p, round2(w.Price*p.Price + w.Performance*p.Performance + w.Reliability*p.Reliability)}
	}
	// Tie-break: lower price, then higher reliability, then offer ID.
	slices.SortStableFunc(items, func(a, b item) int {
		return cmp.Or(
			cmp.Compare(b.score, a.score),
			cmp.Compare(a.offer.PricePerHour, b.offer.PricePerHour),
			cmp.Compare(b.offer.Reliability, a.offer.Reliability),
			strings.Compare(a.offer.ID, b.offer.ID),
		)
	})
	recs := make([]contract.Recommendation, 0, topN)
	for i, it := range items[:min(topN, len(items))] {
		recs = append(recs, contract.Recommendation{
			Rank:  i + 1,
			Offer: it.offer,
			Score: it.score,
			ScoreBreakdown: contract.ScoreBreakdown{
				Price:       round2(it.parts.Price),
				Performance: round2(it.parts.Performance),
				Reliability: round2(it.parts.Reliability),
			},
			Explanations: []string{},
		})
	}
	return recs, nil
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }
