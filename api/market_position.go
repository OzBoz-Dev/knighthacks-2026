package main

import (
	"context"
	"log/slog"
	"math"
	"slices"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/databricks"
)

// mediansTimeout keeps a slow warehouse from holding back the offers.
const mediansTimeout = 2 * time.Second

// medianSource gives the gold median price of each GPU: live first, then the export.
// A nil field is off.
type medianSource struct {
	live   databricks.Querier
	export *databricks.Export
}

// get returns the medians, or nil when Databricks has none. It never fails the caller.
func (m medianSource) get(ctx context.Context) map[string]float64 {
	if m.live != nil {
		ctx, cancel := context.WithTimeout(ctx, mediansTimeout)
		defer cancel()
		med, err := databricks.Medians(ctx, m.live)
		if err == nil {
			return med
		}
		slog.Warn("databricks medians failed", "err", err)
	}
	if m.export != nil {
		return m.export.Medians()
	}
	return nil
}

// withMarketPosition returns a copy of the offers with market_position_pct set from the GPU median.
// The copy keeps the cached snapshot unchanged. An offer with no median keeps null.
func withMarketPosition(offers []contract.Offer, medians map[string]float64) []contract.Offer {
	out := slices.Clone(offers)
	for i := range out {
		if m, ok := medians[out[i].GPUName]; ok && m > 0 {
			p := math.Round((out[i].PricePerHour-m)/m*100*100) / 100
			out[i].MarketPositionPct = &p
		}
	}
	return out
}
