package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/databricks"
	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

type medianQuerier struct {
	rows [][]string
	err  error
}

func (q medianQuerier) Query(context.Context, string, ...databricks.Param) (databricks.Result, error) {
	return databricks.Result{Rows: q.rows}, q.err
}

func TestWithMarketPosition(t *testing.T) {
	offers := []contract.Offer{
		{ID: "below", GPUName: "RTX 4090", PricePerHour: 0.42},
		{ID: "above", GPUName: "A100", PricePerHour: 1.5},
		{ID: "missing", GPUName: "RTX 3060", PricePerHour: 0.1},
		{ID: "zero median", GPUName: "H100", PricePerHour: 2},
	}
	got := withMarketPosition(offers, map[string]float64{"RTX 4090": 0.48, "A100": 1.2, "H100": 0})
	want := map[string]*float64{"below": ptr(-12.5), "above": ptr(25.0), "missing": nil, "zero median": nil}
	for _, o := range got {
		w := want[o.ID]
		if (w == nil) != (o.MarketPositionPct == nil) || (w != nil && *w != *o.MarketPositionPct) {
			t.Errorf("%s: market_position_pct = %v, want %v", o.ID, o.MarketPositionPct, w)
		}
	}
	if offers[0].MarketPositionPct != nil {
		t.Fatal("the input offers must not change")
	}
	if got := withMarketPosition(offers, nil); got[0].MarketPositionPct != nil {
		t.Fatal("no medians must give null")
	}
}

func ptr(v float64) *float64 { return &v }

func TestMedianSourceFallback(t *testing.T) {
	export := &databricks.Export{Summaries: []contract.MarketSummary{{GPUName: "RTX 4090", MedianPrice: 0.4}}}
	ctx := context.Background()
	live := medianQuerier{rows: [][]string{{"RTX 4090", "0.48"}}}
	if m := (medianSource{live: live, export: export}).get(ctx); m["RTX 4090"] != 0.48 {
		t.Fatalf("live: %v", m)
	}
	down := medianQuerier{err: errors.New("warehouse down")}
	if m := (medianSource{live: down, export: export}).get(ctx); m["RTX 4090"] != 0.4 {
		t.Fatalf("export: %v", m)
	}
	if m := (medianSource{live: down}).get(ctx); m != nil {
		t.Fatalf("none: %v", m)
	}
}

func TestOffersIncludeMarketPosition(t *testing.T) {
	snap := vast.Snapshot{CapturedAt: time.Date(2026, 10, 10, 20, 0, 0, 0, time.UTC),
		Offers: []contract.Offer{{ID: "1", GPUName: "RTX 4090", PricePerHour: 0.42}}}
	for name, tc := range map[string]struct {
		m    medianSource
		want *float64
	}{
		"live median":       {medianSource{live: medianQuerier{rows: [][]string{{"RTX 4090", "0.48"}}}}, ptr(-12.5)},
		"databricks failed": {medianSource{live: medianQuerier{err: errors.New("warehouse down")}}, nil},
	} {
		rec := httptest.NewRecorder()
		offersHandler(stubSource{snap: snap}, tc.m.get).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/offers", nil))
		var env struct {
			Data []map[string]json.RawMessage
		}
		json.Unmarshal(rec.Body.Bytes(), &env)
		if rec.Code != http.StatusOK || len(env.Data) != 1 {
			t.Fatalf("%s: status %d body %s", name, rec.Code, rec.Body)
		}
		raw, ok := env.Data[0]["market_position_pct"]
		var got *float64
		json.Unmarshal(raw, &got)
		if !ok || (got == nil) != (tc.want == nil) || (got != nil && *got != *tc.want) {
			t.Errorf("%s: market_position_pct = %s", name, raw)
		}
	}
}
