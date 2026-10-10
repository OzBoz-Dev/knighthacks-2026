package main

import (
	"context"
	"errors"
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
		med, err := m.liveMedians(ctx)
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

// liveMedians waits for the warehouse for at most mediansTimeout. The query itself continues to the
// client timeout and fills the cache, so a slow warehouse still serves the next request.
func (m medianSource) liveMedians(ctx context.Context) (map[string]float64, error) {
	type result struct {
		med map[string]float64
		err error
	}
	done := make(chan result, 1)
	go func() {
		med, err := databricks.Medians(context.WithoutCancel(ctx), m.live)
		done <- result{med, err}
	}()
	timer := time.NewTimer(mediansTimeout)
	defer timer.Stop()
	select {
	case r := <-done:
		return r.med, r.err
	case <-timer.C:
		return nil, errors.New("databricks medians took too long")
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// status gives the databricks component status: the live warehouse through the cache, else the export.
func (m medianSource) status(ctx context.Context) string {
	switch {
	case m.live != nil:
		if _, err := m.liveMedians(ctx); err != nil {
			slog.Warn("health: databricks", "err", err)
			return statusUnavailable
		}
		return statusOK
	case m.export != nil:
		return statusFixture
	}
	return statusUnavailable
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
