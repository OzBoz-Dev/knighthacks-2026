package match

import (
	"math"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// Normalize scales price, performance, and reliability to 0 to 100 over the eligible offers.
// The result has one breakdown for each offer, in input order. The values are not rounded.
func Normalize(eligible []contract.Offer) []contract.ScoreBreakdown {
	price, perf, rel := bounds(), bounds(), bounds()
	for _, o := range eligible {
		price.add(-o.PricePerHour) // Lower price is better, so scale the negative price.
		rel.add(o.Reliability)
		if o.DLPerf != nil {
			perf.add(*o.DLPerf)
		}
	}
	out := make([]contract.ScoreBreakdown, len(eligible))
	for i, o := range eligible {
		out[i] = contract.ScoreBreakdown{
			Price:       price.scale(-o.PricePerHour),
			Reliability: rel.scale(o.Reliability),
		}
		if o.DLPerf != nil {
			out[i].Performance = perf.scale(*o.DLPerf)
		}
	}
	return out
}

type span struct{ lo, hi float64 }

func bounds() span { return span{math.Inf(1), math.Inf(-1)} }

func (s *span) add(v float64) { s.lo, s.hi = min(s.lo, v), max(s.hi, v) }

// scale gives 0 at the minimum and 100 at the maximum. All equal values get 100.
func (s span) scale(v float64) float64 {
	if s.hi == s.lo {
		return 100
	}
	return (v - s.lo) / (s.hi - s.lo) * 100
}
