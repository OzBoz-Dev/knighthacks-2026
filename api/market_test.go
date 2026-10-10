package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/databricks"
)

// rowQuerier is a fake warehouse. It counts the calls.
type rowQuerier struct {
	calls   int
	err     error
	empty   bool // no GPU rows, and no data time when maxNull is set
	maxNull bool
}

func (q *rowQuerier) Query(_ context.Context, stmt string, _ ...databricks.Param) (databricks.Result, error) {
	q.calls++
	if q.err != nil {
		return databricks.Result{}, q.err
	}
	if strings.Contains(stmt, "MAX(") {
		if q.maxNull {
			return databricks.Result{Rows: [][]string{{""}}}, nil
		}
		return databricks.Result{Rows: [][]string{{"2026-10-10 15:00:00"}}}, nil
	}
	if q.empty {
		return databricks.Result{}, nil
	}
	if strings.Contains(stmt, "gpu_market_summary") {
		return databricks.Result{Rows: [][]string{{"RTX 4090", "212", "0.29", "0.48", "0.71", "0.981", "2026-10-10 20:00:00"}}}, nil
	}
	return databricks.Result{Rows: [][]string{
		{"2026-10-10 16:40:00", "0.3", "0.48", "0.32", "0.7", "200"},
		{"2026-10-10 16:50:00", "0.3", "0.49", "0.33", "0.7", "204"},
	}}, nil
}

const handlerExport = `{"exported_at":"2026-10-10T17:00:00Z","snapshot_id":null,
"summaries":[{"gpu_name":"RTX 4090","listing_count":200,"lowest_price":0.3,"median_price":0.47,"p90_price":0.7,"median_reliability":0.98,"updated_at":"2026-10-10T16:50:00Z"}],
"trends":[{"gpu_name":"RTX 4090","region":"ALL","timestamp":"2026-10-10T16:50:00Z","minimum_price":0.3,"median_price":0.49,"p10_price":0.33,"p90_price":0.7,"listing_count":204},
{"gpu_name":"RTX 4090","region":"US","timestamp":"2026-10-10T16:50:00Z","minimum_price":0.3,"median_price":0.49,"p10_price":0.33,"p90_price":0.7,"listing_count":204}]}`

func testExport(t *testing.T) marketReader {
	t.Helper()
	var e databricks.Export
	if err := json.Unmarshal([]byte(handlerExport), &e); err != nil {
		t.Fatal(err)
	}
	return exportMarket{&e}
}

func get(h marketHandler, path string) (int, map[string]any) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/market/summary", h.summary)
	mux.HandleFunc("GET /api/market/trends", h.trends)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
	var body map[string]any
	json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body
}

func TestMarketLiveAndCached(t *testing.T) {
	q := &rowQuerier{}
	h := marketHandler{live: liveMarket{databricks.NewCache(q, time.Now)}}
	for i := 0; i < 2; i++ {
		code, body := get(h, "/api/market/summary?gpu_name=RTX+4090")
		data, _ := body["data"].(map[string]any)
		if code != 200 || body["source"] != "databricks-live" || body["captured_at"] != "2026-10-10T20:00:00Z" ||
			body["snapshot_id"] != nil || data["listing_count"] != float64(212) {
			t.Fatalf("summary %d: %d %v", i, code, body)
		}
	}
	if q.calls != 1 {
		t.Fatalf("the cache must serve the second call, warehouse calls = %d", q.calls)
	}

	code, body := get(h, "/api/market/trends?gpu_name=RTX+4090&region=US")
	pts, _ := body["data"].([]any)
	if code != 200 || body["source"] != "databricks-live" || body["captured_at"] != "2026-10-10T16:50:00Z" || len(pts) != 2 {
		t.Fatalf("trends: %d %v", code, body)
	}
}

func TestMarketExportFallback(t *testing.T) {
	// The live reader fails, so the export answers. Fixture mode (live == nil) answers the same.
	for name, h := range map[string]marketHandler{
		"warehouse fails": {live: liveMarket{&rowQuerier{err: errors.New("down")}}, export: testExport(t)},
		"fixture mode":    {export: testExport(t)},
	} {
		t.Run(name, func(t *testing.T) {
			code, body := get(h, "/api/market/summary?gpu_name=RTX+4090")
			if code != 200 || body["source"] != "databricks-export" || body["captured_at"] != "2026-10-10T17:00:00Z" || body["snapshot_id"] != nil {
				t.Fatalf("summary: %d %v", code, body)
			}
			code, body = get(h, "/api/market/trends?gpu_name=RTX+4090")
			if pts, _ := body["data"].([]any); code != 200 || body["source"] != "databricks-export" || len(pts) != 1 {
				t.Fatalf("trends: %d %v", code, body)
			}
		})
	}
}

func TestMarketSummaryNull(t *testing.T) {
	code, body := get(marketHandler{export: testExport(t)}, "/api/market/summary?gpu_name=A100")
	if v, ok := body["data"]; code != 200 || !ok || v != nil {
		t.Fatalf("want data null: %d %v", code, body)
	}
}

func TestMarketErrors(t *testing.T) {
	h := marketHandler{export: testExport(t)}
	for _, path := range []string{"/api/market/summary", "/api/market/trends?region=US", "/api/market/summary?gpu_name=+"} {
		code, body := get(h, path)
		if e, _ := body["error"].(map[string]any); code != 400 || e["code"] != "bad_request" {
			t.Fatalf("%s: %d %v", path, code, body)
		}
	}
	for _, h := range []marketHandler{{}, {live: liveMarket{&rowQuerier{err: errors.New("down")}}}} {
		code, body := get(h, "/api/market/trends?gpu_name=RTX+4090")
		if e, _ := body["error"].(map[string]any); code != 503 || e["code"] != "upstream_unavailable" {
			t.Fatalf("no data: %d %v", code, body)
		}
	}
}

func TestMarketLiveNoRow(t *testing.T) {
	h := marketHandler{live: liveMarket{&rowQuerier{empty: true}}, export: testExport(t)}
	_, body := get(h, "/api/market/summary?gpu_name=A100")
	if body["source"] != "databricks-live" || body["captured_at"] != "2026-10-10T15:00:00Z" || body["data"] != nil {
		t.Fatalf("summary: %v", body)
	}
	_, body = get(h, "/api/market/trends?gpu_name=A100")
	if pts, _ := body["data"].([]any); body["captured_at"] != "2026-10-10T15:00:00Z" || len(pts) != 0 {
		t.Fatalf("trends: %v", body)
	}

	// No data time at all: the export answers, so captured_at is never empty.
	h.live = liveMarket{&rowQuerier{empty: true, maxNull: true}}
	_, body = get(h, "/api/market/summary?gpu_name=RTX+4090")
	if body["source"] != "databricks-export" || body["captured_at"] != "2026-10-10T17:00:00Z" {
		t.Fatalf("fallback: %v", body)
	}
}
