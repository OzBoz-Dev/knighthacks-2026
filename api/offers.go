package main

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/httpx"
	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

// vastFixturePath is relative to the api folder, where the API starts.
const vastFixturePath = "../fixtures/vast_offers.json"

// newOfferSource gives the saved fixture in fixture mode, and the 60 second cache otherwise.
// In live mode a saved file, when it exists, answers while Vast.ai has no data.
func newOfferSource(cfg Config, client vast.Fetcher, fixturePath string) (vast.Source, error) {
	if cfg.UseVastFixture {
		return vast.LoadFixture(fixturePath)
	}
	live := vast.NewCache(client, time.Minute, time.Now)
	saved, err := vast.LoadFixture(fixturePath)
	if err != nil {
		return live, nil
	}
	return withSaved{live, saved}, nil
}

type withSaved struct {
	live  vast.Source
	saved vast.Snapshot
}

func (w withSaved) Get(ctx context.Context) (vast.Snapshot, error) {
	snap, err := w.live.Get(ctx)
	if err != nil {
		return w.saved, nil
	}
	return snap, nil
}

// offersHandler serves GET /api/offers. It does not filter, because Explore and Match filter.
// medians gives the gold median of each GPU for the market position, or nil.
func offersHandler(src vast.Source, medians func(context.Context) map[string]float64) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		snap, err := src.Get(r.Context())
		if err != nil {
			slog.Error("offers unavailable", "err", err)
			httpx.WriteError(w, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "No offers are available now. Try again in a minute.")
			return
		}
		source := contract.SourceVastLive
		if snap.Saved {
			source = contract.SourceVastSaved
		}
		id := vast.SnapshotID(snap.CapturedAt)
		httpx.WriteJSON(w, http.StatusOK, contract.Envelope[[]contract.Offer]{
			Source:     source,
			CapturedAt: snap.CapturedAt.UTC().Format(time.RFC3339),
			SnapshotID: &id,
			Data:       withMarketPosition(snap.Offers, medians(r.Context())),
		})
	}
}
