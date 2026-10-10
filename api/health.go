package main

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/httpx"
)

// The component status values of the #26 proposal.
const (
	statusOK          = "ok"
	statusFixture     = "fixture"
	statusUnavailable = "unavailable"
)

// healthTimeout bounds the SQLite check. The Databricks check waits at most mediansTimeout.
const healthTimeout = 2 * time.Second

// healthChecks holds the inputs of GET /api/health. Tests pass fakes.
type healthChecks struct {
	vastFixture, databricksFixture bool
	vast                           func() string                // the last offers read, no Vast.ai call
	databricks                     func(context.Context) string // through the 5 minute cache, at most mediansTimeout
	sqlite                         func(context.Context) error
}

type healthResponse struct {
	Status     string `json:"status"`
	Components struct {
		Vast       string `json:"vast"`
		Databricks string `json:"databricks"`
		SQLite     string `json:"sqlite"`
	} `json:"components"`
	Fixtures struct {
		Vast       bool `json:"vast"`
		Databricks bool `json:"databricks"`
	} `json:"fixtures"`
}

// healthHandler serves GET /api/health. SQLite unavailable gives 503 upstream_unavailable.
func healthHandler(h healthChecks) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), healthTimeout)
		defer cancel()
		if err := h.sqlite(ctx); err != nil {
			slog.Error("health: sqlite", "err", err)
			httpx.WriteError(w, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "The reservation database is unavailable.")
			return
		}
		var resp healthResponse
		resp.Fixtures.Vast, resp.Fixtures.Databricks = h.vastFixture, h.databricksFixture
		resp.Components.SQLite = statusOK
		resp.Components.Vast = statusFixture
		if !h.vastFixture {
			resp.Components.Vast = h.vast()
		}
		resp.Components.Databricks = h.databricks(r.Context())
		resp.Status = statusOK
		if resp.Components.Vast == statusUnavailable || resp.Components.Databricks == statusUnavailable {
			resp.Status = "degraded"
		}
		httpx.WriteJSON(w, http.StatusOK, resp)
	}
}

// pingSQLite reads the reservations table, so a missing table also fails.
func pingSQLite(db *sql.DB) func(context.Context) error {
	return func(ctx context.Context) error {
		_, err := db.ExecContext(ctx, "SELECT 1 FROM reservations LIMIT 1")
		return err
	}
}
