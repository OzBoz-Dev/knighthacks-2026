package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/databricks"
	"github.com/OzBoz-Dev/knighthacks-2026/api/store"
	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

func TestHealth(t *testing.T) {
	status := func(s string) func() string { return func() string { return s } }
	dbStatus := func(s string) func(context.Context) string { return func(context.Context) string { return s } }
	sqliteOK := func(context.Context) error { return nil }
	for name, tc := range map[string]struct {
		checks healthChecks
		want   string
	}{
		"all live": {healthChecks{false, false, status("ok"), dbStatus("ok"), sqliteOK},
			`{"status":"ok","components":{"vast":"ok","databricks":"ok","sqlite":"ok"},"fixtures":{"vast":false,"databricks":false}}`},
		"fixture mode": {healthChecks{true, true, status("unavailable"), dbStatus("fixture"), sqliteOK},
			`{"status":"ok","components":{"vast":"fixture","databricks":"fixture","sqlite":"ok"},"fixtures":{"vast":true,"databricks":true}}`},
		"vast down": {healthChecks{false, true, status("unavailable"), dbStatus("fixture"), sqliteOK},
			`{"status":"degraded","components":{"vast":"unavailable","databricks":"fixture","sqlite":"ok"},"fixtures":{"vast":false,"databricks":true}}`},
		"databricks down": {healthChecks{false, false, status("ok"), dbStatus("unavailable"), sqliteOK},
			`{"status":"degraded","components":{"vast":"ok","databricks":"unavailable","sqlite":"ok"},"fixtures":{"vast":false,"databricks":false}}`},
		"sqlite down": {healthChecks{false, false, status("ok"), dbStatus("ok"), func(context.Context) error { return errors.New("disk I/O error") }},
			`{"error":{"code":"upstream_unavailable","message":"The reservation database is unavailable."}}`},
	} {
		w := httptest.NewRecorder()
		healthHandler(tc.checks).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/health", nil))
		wantCode := http.StatusOK
		if name == "sqlite down" {
			wantCode = http.StatusServiceUnavailable
		}
		var got, want any
		json.Unmarshal(w.Body.Bytes(), &got)
		json.Unmarshal([]byte(tc.want), &want)
		if w.Code != wantCode || !jsonEqual(got, want) {
			t.Errorf("%s: status %d body %s", name, w.Code, w.Body)
		}
	}
}

func jsonEqual(a, b any) bool {
	x, _ := json.Marshal(a)
	y, _ := json.Marshal(b)
	return string(x) == string(y)
}

func TestPingSQLite(t *testing.T) {
	db, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	if err := pingSQLite(db)(context.Background()); err != nil {
		t.Fatal(err)
	}
	db.Close()
	if err := pingSQLite(db)(context.Background()); err == nil {
		t.Fatal("a closed database must fail")
	}
}

func TestDatabricksStatus(t *testing.T) {
	export := &databricks.Export{Summaries: []contract.MarketSummary{{GPUName: "RTX 4090", MedianPrice: 0.4}}}
	up := medianQuerier{rows: [][]string{{"RTX 4090", "0.48"}}}
	down := medianQuerier{err: errors.New("warehouse down")}
	for _, tc := range []struct {
		m    medianSource
		want string
	}{
		{medianSource{live: up, export: export}, "ok"},
		{medianSource{live: down, export: export}, "unavailable"},
		{medianSource{export: export}, "fixture"},
		{medianSource{}, "unavailable"},
	} {
		m, want := tc.m, tc.want
		if got := m.status(context.Background()); got != want {
			t.Errorf("%+v: %s, want %s", m, got, want)
		}
	}
}

func TestVastStatus(t *testing.T) {
	ctx := context.Background()
	at := time.Date(2026, 10, 10, 20, 0, 0, 0, time.UTC)
	src := &stubSource{snap: vast.Snapshot{CapturedAt: at}}
	r := newRecentSnapshots(src)
	if got := r.vastStatus(); got != "unavailable" {
		t.Fatalf("before the first read: %s", got)
	}
	r.Get(ctx)
	if got := r.vastStatus(); got != "ok" {
		t.Fatalf("live: %s", got)
	}
	src.snap.Saved = true
	r.Get(ctx)
	if got := r.vastStatus(); got != "unavailable" {
		t.Fatalf("saved: %s", got)
	}
	src.snap.Saved, src.err = false, errors.New("no vast data")
	r.Get(ctx)
	if got := r.vastStatus(); got != "unavailable" {
		t.Fatalf("error: %s", got)
	}
}
