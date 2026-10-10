package match

import (
	"cmp"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// Explain writes two to four explanations for each recommendation from real values only.
// medians maps gpu_name to the Databricks median price. It is nil when Databricks is unavailable.
func Explain(recs []contract.Recommendation, eligible []contract.Offer, req contract.MatchRequest, medians map[string]float64) {
	best := math.Inf(-1)
	for _, o := range eligible {
		if o.PerformancePerDollar != nil {
			best = max(best, *o.PerformancePerDollar)
		}
	}
	for i := range recs {
		o := recs[i].Offer
		vram := gb(vramOf(o)) + " GB VRAM."
		if req.MinVRAMGB > 0 {
			vram = fmt.Sprintf("%s GB VRAM meets your %s GB requirement.", gb(vramOf(o)), gb(req.MinVRAMGB))
		}
		ex := []string{vram}
		if m, ok := medians[o.GPUName]; ok && m > 0 {
			switch d := math.Round((m - o.PricePerHour) / m * 100); {
			case d > 0:
				ex = append(ex, fmt.Sprintf("%s, %v%% below the typical %s price.", money(o.PricePerHour), d, o.GPUName))
			case d < 0:
				ex = append(ex, fmt.Sprintf("%s, %v%% above the typical %s price.", money(o.PricePerHour), -d, o.GPUName))
			default:
				ex = append(ex, fmt.Sprintf("%s, about the typical %s price.", money(o.PricePerHour), o.GPUName))
			}
		}
		ex = append(ex, pctDown(o.Reliability)+" reliability.")
		if o.PerformancePerDollar != nil && *o.PerformancePerDollar == best {
			ex = append(ex, "Best performance-per-dollar among the suitable offers.")
		}
		recs[i].Explanations = ex
	}
}

// Suggest gives one suggestion when no offer is eligible. It uses the filter with the largest
// exclusion count. Equal counts take the first filter in the prd.md section 5.2 order.
func Suggest(offers []contract.Offer, req contract.MatchRequest, ex contract.Excluded) string {
	if len(offers) == 0 {
		return "No offers were available to check. Try again in a few minutes."
	}
	top := 0
	for i := range filters {
		if *filters[i].count(&ex) > *filters[top].count(&ex) {
			top = i
		}
	}
	n := *filters[top].count(&ex)
	head := fmt.Sprintf("%s excluded %d offer", filters[top].name, n)
	if n != 1 {
		head += "s"
	}
	// The threshold comes from the offers that fail only this filter, so a change to it makes them eligible.
	var only []contract.Offer
	for _, o := range offers {
		if slices.IndexFunc(filters, func(f filter) bool { return f.fails(o, req) && f.name != filters[top].name }) < 0 {
			only = append(only, o)
		}
	}
	if len(only) == 0 {
		return head + "; try loosening that filter."
	}
	cheapest := slices.MinFunc(only, func(a, b contract.Offer) int {
		return cmp.Or(cmp.Compare(a.PricePerHour, b.PricePerHour), strings.Compare(a.ID, b.ID))
	})
	switch filters[top].name {
	case "GPU model":
		return fmt.Sprintf("%s; try adding the %s.", head, cheapest.GPUName)
	case "Region":
		return fmt.Sprintf("%s; try the %s region.", head, cheapest.Region)
	case "VRAM":
		v := slices.MaxFunc(only, func(a, b contract.Offer) int { return cmp.Compare(vramOf(a), vramOf(b)) })
		// Round down so the suggested value still lets the offer pass.
		return fmt.Sprintf("%s; try lowering it to %s GB.", head, gb(math.Floor(vramOf(v)*10+1e-9)/10))
	case "Reliability":
		r := slices.MaxFunc(only, func(a, b contract.Offer) int { return cmp.Compare(a.Reliability, b.Reliability) })
		return fmt.Sprintf("%s; try lowering it to %s.", head, pctDown(r.Reliability))
	default:
		// Round up to the cent so the suggested budget still lets the offer pass.
		return fmt.Sprintf("%s; try raising it to %s.", head, money(math.Ceil(cheapest.PricePerHour*100-1e-9)/100))
	}
}

func money(v float64) string { return fmt.Sprintf("$%.2f/hour", v) }

// gb shows a VRAM size with at most one decimal.
func gb(v float64) string { return strconv.FormatFloat(math.Round(v*10)/10, 'f', -1, 64) }

// pctDown shows a ratio as a percentage with one decimal, rounded down so 0.9996 never shows as 100%.
func pctDown(r float64) string {
	return strconv.FormatFloat(math.Floor(r*1000+1e-9)/10, 'f', -1, 64) + "%"
}
