package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

type stubSource struct {
	snap vast.Snapshot
	err  error
}

func (s stubSource) Get(context.Context) (vast.Snapshot, error) { return s.snap, s.err }

type stubFetcher struct {
	at   time.Time
	fail bool
}

func (f *stubFetcher) Fetch(context.Context) (vast.Result, error) {
	if f.fail {
		return vast.Result{}, errors.New("vast: status 500")
	}
	return vast.Result{CapturedAt: f.at, Offers: []json.RawMessage{
		json.RawMessage(`{"id":1,"gpu_name":"RTX 4090","num_gpus":1,"gpu_ram":24576,"dph_total":0.5,"reliability2":0.9,"geolocation":"Texas, US"}`),
	}}, nil
}

func noMedians(context.Context) map[string]float64 { return nil }

func getOffers(t *testing.T, src vast.Source) (int, contract.Envelope[[]contract.Offer]) {
	t.Helper()
	rec := httptest.NewRecorder()
	offersHandler(src, noMedians).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/offers", nil))
	var env contract.Envelope[[]contract.Offer]
	if rec.Code == http.StatusOK {
		if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
			t.Fatal(err)
		}
	}
	return rec.Code, env
}

func TestOffersLiveThenCachedSaved(t *testing.T) {
	at := time.Date(2026, 10, 10, 20, 10, 0, 0, time.UTC)
	clock := at
	f := &stubFetcher{at: at}
	cache := vast.NewCache(f, time.Minute, func() time.Time { return clock })

	code, env := getOffers(t, cache)
	if code != 200 || env.Source != contract.SourceVastLive || env.CapturedAt != "2026-10-10T20:10:00Z" ||
		env.SnapshotID == nil || *env.SnapshotID != "snap_20261010T201000Z" || len(env.Data) != 1 || env.Data[0].Region != "US" {
		t.Fatalf("live: %d %+v", code, env)
	}

	clock = clock.Add(2 * time.Minute)
	f.fail = true
	code, env = getOffers(t, cache)
	if code != 200 || env.Source != contract.SourceVastSaved || env.CapturedAt != "2026-10-10T20:10:00Z" {
		t.Fatalf("cached saved: %d %+v", code, env)
	}
}

func TestOffersFixtureMode(t *testing.T) {
	path := filepath.Join(t.TempDir(), "vast_offers.json")
	body := `{"source":"vast-saved","captured_at":"2026-10-10T18:00:00Z","snapshot_id":"snap_20261010T180000Z","data":[]}`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	src, err := newOfferSource(Config{UseVastFixture: true}, nil, path)
	if err != nil {
		t.Fatal(err)
	}
	code, env := getOffers(t, src)
	if code != 200 || env.Source != contract.SourceVastSaved || env.CapturedAt != "2026-10-10T18:00:00Z" ||
		*env.SnapshotID != "snap_20261010T180000Z" || env.Data == nil {
		t.Fatalf("fixture: %d %+v", code, env)
	}
}

func TestOffersLiveDownServesSavedFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "vast_offers.json")
	body := `{"source":"vast-saved","captured_at":"2026-10-10T18:00:00Z","snapshot_id":"snap_20261010T180000Z","data":[]}`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	src, err := newOfferSource(Config{}, &stubFetcher{fail: true}, path)
	if err != nil {
		t.Fatal(err)
	}
	code, env := getOffers(t, src)
	if code != 200 || env.Source != contract.SourceVastSaved || env.CapturedAt != "2026-10-10T18:00:00Z" {
		t.Fatalf("%d %+v", code, env)
	}
	// With no saved file the cache error becomes a 503.
	src, _ = newOfferSource(Config{}, &stubFetcher{fail: true}, filepath.Join(t.TempDir(), "none.json"))
	if code, _ := getOffers(t, src); code != 503 {
		t.Fatalf("code = %d", code)
	}
}

func TestOffersNoData(t *testing.T) {
	rec := httptest.NewRecorder()
	offersHandler(stubSource{err: errors.New("no vast data")}, noMedians).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/offers", nil))
	var body map[string]map[string]string
	json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != 503 || body["error"]["code"] != "upstream_unavailable" {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
}
