package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

var matchSnap = vast.Snapshot{
	CapturedAt: time.Date(2026, 10, 10, 20, 0, 0, 0, time.UTC),
	Offers: []contract.Offer{
		{ID: "1", GPUName: "RTX 4090", NumGPUs: 1, GPURAMGB: 24, TotalVRAMGB: 24, Region: "US", PricePerHour: 0.42, Reliability: 0.99},
		{ID: "2", GPUName: "RTX 3090", NumGPUs: 1, GPURAMGB: 24, TotalVRAMGB: 24, Region: "US", PricePerHour: 2, Reliability: 0.99},
		{ID: "3", GPUName: "RTX 3060", NumGPUs: 1, GPURAMGB: 12, TotalVRAMGB: 12, Region: "US", PricePerHour: 0.1, Reliability: 0.99},
	},
}

const validMatch = `{"min_vram_gb":24,"max_price_per_hour":1,"min_reliability":0.97,"priority":"balanced"}`

func postMatch(t *testing.T, src vast.Source, body string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	matchHandler(src, noMedians).ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/match", strings.NewReader(body)))
	return w
}

func TestMatchValid(t *testing.T) {
	w := postMatch(t, stubSource{snap: matchSnap}, validMatch)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body %s", w.Code, w.Body)
	}
	var raw map[string]json.RawMessage
	json.Unmarshal(w.Body.Bytes(), &raw)
	for _, k := range []string{"request_id", "snapshot_id", "checked", "eligible", "excluded", "recommendations"} {
		if _, ok := raw[k]; !ok {
			t.Errorf("missing %s in %s", k, w.Body)
		}
	}
	var resp contract.MatchResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^req_[0-9a-f]{16}$`).MatchString(resp.RequestID) || resp.SnapshotID != "snap_20261010T200000Z" ||
		resp.Checked != 3 || resp.Eligible != 1 || resp.Excluded.VRAM != 1 || resp.Excluded.Budget != 1 ||
		len(resp.Recommendations) != 1 || resp.Recommendations[0].Offer.ID != "1" || resp.Recommendations[0].Rank != 1 {
		t.Fatalf("response %+v", resp)
	}
}

func TestMatchNoEligibleOffer(t *testing.T) {
	w := postMatch(t, stubSource{snap: matchSnap}, strings.Replace(validMatch, `"max_price_per_hour":1`, `"max_price_per_hour":0.01`, 1))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"recommendations":[]`) {
		t.Fatalf("status %d body %s", w.Code, w.Body)
	}
}

func TestMatchBadRequest(t *testing.T) {
	for name, tc := range map[string]struct{ body, want string }{
		"negative vram":       {strings.Replace(validMatch, `"min_vram_gb":24`, `"min_vram_gb":-1`, 1), "min_vram_gb"},
		"zero budget":         {strings.Replace(validMatch, `"max_price_per_hour":1`, `"max_price_per_hour":0`, 1), "max_price_per_hour"},
		"negative budget":     {strings.Replace(validMatch, `"max_price_per_hour":1`, `"max_price_per_hour":-2`, 1), "max_price_per_hour"},
		"missing budget":      {`{"min_vram_gb":24,"min_reliability":0.9,"priority":"balanced"}`, "max_price_per_hour"},
		"reliability above 1": {strings.Replace(validMatch, `0.97`, `97`, 1), "min_reliability"},
		"reliability below 0": {strings.Replace(validMatch, `0.97`, `-0.1`, 1), "min_reliability"},
		"unknown priority":    {strings.Replace(validMatch, `balanced`, `fast`, 1), "priority"},
		"wrong type":          {strings.Replace(validMatch, `24`, `"24"`, 1), "min_vram_gb has the wrong type"},
		"unknown field":       {strings.Replace(validMatch, `{`, `{"gpu":"x",`, 1), "does not accept"},
		"not json":            {`min_vram_gb=24`, "not valid JSON"},
		"empty body":          {``, "not valid JSON"},
		"too large":           {`{"region":"` + strings.Repeat("a", 1<<17) + `"}`, "too large"},
	} {
		w := postMatch(t, stubSource{snap: matchSnap}, tc.body)
		var body struct {
			Error struct{ Code, Message string }
		}
		json.Unmarshal(w.Body.Bytes(), &body)
		if w.Code != http.StatusBadRequest || body.Error.Code != "bad_request" || !strings.Contains(body.Error.Message, tc.want) {
			t.Errorf("%s: status %d body %s", name, w.Code, w.Body)
		}
	}
}

func TestMatchNoOffers(t *testing.T) {
	w := postMatch(t, stubSource{err: errors.New("no vast data")}, validMatch)
	if w.Code != http.StatusServiceUnavailable || !strings.Contains(w.Body.String(), `"upstream_unavailable"`) {
		t.Fatalf("status %d body %s", w.Code, w.Body)
	}
}

func TestMatchUsesMedians(t *testing.T) {
	medians := func(context.Context) map[string]float64 { return map[string]float64{"RTX 4090": 0.48} }
	w := httptest.NewRecorder()
	matchHandler(stubSource{snap: matchSnap}, medians).ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/match", strings.NewReader(validMatch)))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "below the typical RTX 4090 price") {
		t.Fatalf("status %d body %s", w.Code, w.Body)
	}
}
