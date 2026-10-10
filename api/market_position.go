package main

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"slices"
	"sync/atomic"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/databricks"
)

// mediansTimeout keeps a slow warehouse from holding back the offers. Tests make it short.
var mediansTimeout = 2 * time.Second

// failureMemory is how long a live failure sends every request to the export with no warehouse call.
const failureMemory = 30 * time.Second

// medianSource gives the gold median price of each GPU: live first, then the export.
// A nil field is off.
type medianSource struct {
	live     databricks.Querier
	export   *databricks.Export
	failedAt atomic.Int64 // unix nanoseconds of the last live failure, 0 after a success
}

// get returns the medians, or nil when Databricks has none. It never fails the caller.
func (m *medianSource) get(ctx context.Context) map[string]float64 {
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
// After a failure it makes no call for failureMemory, so a down warehouse does not slow each request.
func (m *medianSource) liveMedians(ctx context.Context) (map[string]float64, error) {
	if at := m.failedAt.Load(); at != 0 && time.Since(time.Unix(0, at)) < failureMemory {
		return nil, errors.New("databricks failed less than 30 s ago")
	}
	type result struct {
		med map[string]float64
		err error
	}
	done := make(chan result, 1)
	go func() {
		med, err := databricks.Medians(context.WithoutCancel(ctx), m.live)
		if err == nil {
			m.failedAt.Store(0) // a late success also ends the failure memory
		} else {
			m.failedAt.Store(time.Now().UnixNano())
		}
		done <- result{med, err}
	}()
	timer := time.NewTimer(mediansTimeout)
	defer timer.Stop()
	select {
	case r := <-done:
		return r.med, r.err
	case <-timer.C:
		select {
		case r := <-done: // the query ended at the same time as the timer
			return r.med, r.err
		default:
		}
		m.failedAt.CompareAndSwap(0, time.Now().UnixNano())
		return nil, errors.New("databricks medians took too long")
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// status gives the databricks component status: the live warehouse through the cache, else the export.
func (m *medianSource) status(ctx context.Context) string {
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
