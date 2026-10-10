package main

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/httpx"
	"github.com/OzBoz-Dev/knighthacks-2026/api/match"
	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

// matchHandler serves POST /api/match on the current offer snapshot.
// medians gives the gold median of each GPU for the explanations, or nil.
func matchHandler(src vast.Source, medians func(context.Context) map[string]float64) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req contract.MatchRequest
		if !decodeBody(w, r, &req) {
			return
		}
		if msg := validateMatch(req); msg != "" {
			httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, msg)
			return
		}
		snap, err := src.Get(r.Context())
		if err != nil {
			slog.Error("match: offers unavailable", "err", err)
			httpx.WriteError(w, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "No offers are available now. Try again in a minute.")
			return
		}
		// The frozen MatchResponse has no field for the suggestion, so the handler drops it.
		resp, _, err := match.Run(snap.Offers, req, medians(r.Context()))
		if err == nil {
			resp.RequestID, err = newID("req_")
		}
		if err != nil {
			slog.Error("match run", "err", err)
			httpx.WriteError(w, http.StatusInternalServerError, httpx.CodeInternal, "The match failed. Try again.")
			return
		}
		resp.SnapshotID = vast.SnapshotID(snap.CapturedAt)
		httpx.WriteJSON(w, http.StatusOK, resp)
	}
}

// validateMatch returns a message for the first field that is not valid, or "".
func validateMatch(req contract.MatchRequest) string {
	switch {
	case req.MinVRAMGB < 0:
		return "min_vram_gb must not be negative."
	case req.MaxPricePerHour <= 0:
		return "max_price_per_hour must be above zero."
	case req.MinReliability < 0 || req.MinReliability > 1:
		return "min_reliability must be from 0 to 1."
	case req.Priority != contract.PriorityCheapest && req.Priority != contract.PriorityBalanced &&
		req.Priority != contract.PriorityPerformance:
		return "priority must be cheapest, balanced, or performance."
	}
	return ""
}
