// Package match ranks offers for a match request, as prd.md section 5.2 says.
package match

import (
	"slices"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// vramOf is the one VRAM rule. Issue #36 chose VRAM per GPU, so it reads GPURAMGB, not TotalVRAMGB.
func vramOf(o contract.Offer) float64 { return o.GPURAMGB }

// filter is one hard eligibility filter. fails is true when the offer does not meet the request.
type filter struct {
	name  string
	fails func(o contract.Offer, req contract.MatchRequest) bool
	count func(ex *contract.Excluded) *int
}

// filters holds the hard eligibility filters in the prd.md section 5.2 order.
var filters = []filter{
	{"GPU model", func(o contract.Offer, req contract.MatchRequest) bool {
		return len(req.GPUNames) > 0 && !slices.Contains(req.GPUNames, o.GPUName)
	}, func(ex *contract.Excluded) *int { return &ex.GPUModel }},
	{"Region", func(o contract.Offer, req contract.MatchRequest) bool {
		return req.Region != "" && o.Region != req.Region
	}, func(ex *contract.Excluded) *int { return &ex.Region }},
	{"VRAM per GPU", func(o contract.Offer, req contract.MatchRequest) bool {
		return vramOf(o) < req.MinVRAMGB
	}, func(ex *contract.Excluded) *int { return &ex.VRAM }},
	{"Reliability", func(o contract.Offer, req contract.MatchRequest) bool {
		return o.Reliability < req.MinReliability
	}, func(ex *contract.Excluded) *int { return &ex.Reliability }},
	{"Budget", func(o contract.Offer, req contract.MatchRequest) bool {
		return o.PricePerHour > req.MaxPricePerHour
	}, func(ex *contract.Excluded) *int { return &ex.Budget }},
}

// Filter returns the offers that pass every filter, in input order.
// It counts each other offer against the first filter that the offer fails.
func Filter(offers []contract.Offer, req contract.MatchRequest) ([]contract.Offer, contract.Excluded) {
	var eligible []contract.Offer
	var ex contract.Excluded
	for _, o := range offers {
		i := slices.IndexFunc(filters, func(f filter) bool { return f.fails(o, req) })
		if i < 0 {
			eligible = append(eligible, o)
			continue
		}
		*filters[i].count(&ex)++
	}
	return eligible, ex
}
