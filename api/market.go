package main

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/databricks"
	"github.com/OzBoz-Dev/knighthacks-2026/api/httpx"
)

const exportPath = "../fixtures/databricks_market.json"

// marketReader gives the market data as the #26 envelope. The live reader and the export reader share it.
type marketReader interface {
	Summary(ctx context.Context, gpuName string) (contract.Envelope[*contract.MarketSummary], error)
	Trends(ctx context.Context, gpuName, region string) (contract.Envelope[[]contract.TrendPoint], error)
}

// liveMarket reads the gold tables. captured_at is the data time, never the fetch time.
// With no row, it uses the newest data time of the table. If that fails, the caller falls back to the export.
type liveMarket struct{ q databricks.Querier }

func (l liveMarket) Summary(ctx context.Context, gpuName string) (contract.Envelope[*contract.MarketSummary], error) {
	s, err := databricks.Summary(ctx, l.q, gpuName)
	env := contract.Envelope[*contract.MarketSummary]{Source: contract.SourceDatabricksLive, Data: s}
	if err != nil {
		return env, err
	}
	if s != nil {
		env.CapturedAt = s.UpdatedAt
	} else {
		env.CapturedAt, err = databricks.SummaryUpdatedAt(ctx, l.q)
	}
	return env, err
}

func (l liveMarket) Trends(ctx context.Context, gpuName, region string) (contract.Envelope[[]contract.TrendPoint], error) {
	pts, err := databricks.Trends(ctx, l.q, gpuName, region)
	env := contract.Envelope[[]contract.TrendPoint]{Source: contract.SourceDatabricksLive, Data: pts}
	if err != nil {
		return env, err
	}
	if len(pts) > 0 {
		env.CapturedAt = pts[len(pts)-1].Timestamp
	} else {
		env.CapturedAt, err = databricks.TrendsUpdatedAt(ctx, l.q)
	}
	return env, err
}

// exportMarket serves the saved export with its original export time.
type exportMarket struct{ e *databricks.Export }

func (x exportMarket) Summary(_ context.Context, gpuName string) (contract.Envelope[*contract.MarketSummary], error) {
	return contract.Envelope[*contract.MarketSummary]{Source: contract.SourceDatabricksExport, CapturedAt: x.e.ExportedAt, SnapshotID: x.e.SnapshotID, Data: x.e.Summary(gpuName)}, nil
}

func (x exportMarket) Trends(_ context.Context, gpuName, region string) (contract.Envelope[[]contract.TrendPoint], error) {
	return contract.Envelope[[]contract.TrendPoint]{Source: contract.SourceDatabricksExport, CapturedAt: x.e.ExportedAt, SnapshotID: x.e.SnapshotID, Data: x.e.TrendPoints(gpuName, region)}, nil
}

// marketHandler tries live first and falls back to the export. A nil reader is off.
type marketHandler struct{ live, export marketReader }

// respond writes the live result, else the export, else 503 upstream_unavailable.
func respond[T any](w http.ResponseWriter, h marketHandler, get func(marketReader) (contract.Envelope[T], error)) {
	if h.live != nil {
		env, err := get(h.live)
		if err == nil {
			httpx.WriteJSON(w, http.StatusOK, env)
			return
		}
		slog.Warn("databricks live read failed", "err", err)
	}
	if h.export != nil {
		if env, err := get(h.export); err == nil {
			httpx.WriteJSON(w, http.StatusOK, env)
			return
		}
	}
	httpx.WriteError(w, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "Pricing insights are temporarily unavailable.")
}

func (h marketHandler) summary(w http.ResponseWriter, r *http.Request) {
	gpu := strings.TrimSpace(r.URL.Query().Get("gpu_name"))
	if gpu == "" {
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, "gpu_name is required")
		return
	}
	respond(w, h, func(m marketReader) (contract.Envelope[*contract.MarketSummary], error) {
		return m.Summary(r.Context(), gpu)
	})
}

func (h marketHandler) trends(w http.ResponseWriter, r *http.Request) {
	gpu := strings.TrimSpace(r.URL.Query().Get("gpu_name"))
	if gpu == "" {
		httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, "gpu_name is required")
		return
	}
	region := strings.TrimSpace(r.URL.Query().Get("region"))
	respond(w, h, func(m marketReader) (contract.Envelope[[]contract.TrendPoint], error) {
		return m.Trends(r.Context(), gpu, region)
	})
}

// registerMarket adds the market routes. Fixture mode skips the warehouse.
func registerMarket(mux *http.ServeMux, cfg Config) {
	var h marketHandler
	if !cfg.UseDatabricksFixture {
		c, err := databricks.NewClient(cfg.DatabricksHost, cfg.DatabricksToken, cfg.DatabricksWarehouseID)
		if err != nil {
			slog.Error("databricks client", "err", err)
		} else {
			h.live = liveMarket{databricks.NewCache(c, time.Now)}
		}
	}
	if e, err := databricks.LoadExport(exportPath); err != nil {
		slog.Warn("databricks export unavailable", "err", err)
	} else {
		h.export = exportMarket{e}
	}
	mux.HandleFunc("GET /api/market/summary", h.summary)
	mux.HandleFunc("GET /api/market/trends", h.trends)
}
