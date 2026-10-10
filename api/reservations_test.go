package main

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"encoding/json"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/reservation"
	"github.com/OzBoz-Dev/knighthacks-2026/api/store"
)

type fakeOffers map[string]contract.Offer

func (f fakeOffers) Offer(snapshotID, id string) (contract.Offer, bool) {
	o, ok := f[id]
	return o, ok && snapshotID == "snap_1"
}

const goodWallet = "11111111111111111111111111111111"

func post(t *testing.T, body string) (*httptest.ResponseRecorder, http.Handler) {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	h := createReservation(db, fakeOffers{"o1": {ID: "o1", GPUName: "RTX 4090", PricePerHour: 0.42}})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("POST", "/api/reservations", strings.NewReader(body)))
	if w.Code == http.StatusCreated {
		var res contract.Reservation
		json.Unmarshal(w.Body.Bytes(), &res)
		got, err := store.Get(db, res.ID)
		if err != nil || got.CanonicalPayload != res.CanonicalPayload {
			t.Fatalf("stored payload differs: %v", err)
		}
	}
	return w, h
}

func valid(wallet, offer string) string {
	return `{"request_id":"req_1","snapshot_id":"snap_1","offer_id":"` + offer + `","wallet":"` + wallet +
		`","min_vram_gb":24,"max_price_per_hour":1,"priority":"balanced","region":null}`
}

func TestCreateReservation(t *testing.T) {
	w, _ := post(t, valid(goodWallet, "o1"))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body %s", w.Code, w.Body)
	}
	var res contract.Reservation
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	payload, hash, _ := reservation.Payload(res)
	if !regexp.MustCompile(`^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$`).MatchString(res.CreatedAt) {
		t.Fatalf("created_at = %s", res.CreatedAt)
	}
	if res.Status != contract.StatusPending || res.GPUName != "RTX 4090" || res.PricePerHour != 0.42 ||
		!strings.HasPrefix(res.ID, "res_") || len(res.ID) != 20 ||
		res.CanonicalPayload != payload || res.PayloadHash != hash {
		t.Fatalf("reservation = %+v", res)
	}
}

func TestCreateReservationBadRequest(t *testing.T) {
	for name, body := range map[string]string{
		"bad json":       `{`,
		"unknown field":  `{"gpu_name":"x"}`,
		"bad wallet":     valid("not-a-wallet", "o1"),
		"wrong snapshot": strings.Replace(valid(goodWallet, "o1"), "snap_1", "snap_old", 1),
		"unknown offer":  valid(goodWallet, "nope"),
		"bad priority":   strings.Replace(valid(goodWallet, "o1"), "balanced", "fast", 1),
		"zero budget":    strings.Replace(valid(goodWallet, "o1"), `"max_price_per_hour":1`, `"max_price_per_hour":0`, 1),
		"missing ids":    strings.Replace(valid(goodWallet, "o1"), `"request_id":"req_1"`, `"request_id":""`, 1),
		"negative vram":  strings.Replace(valid(goodWallet, "o1"), `"min_vram_gb":24`, `"min_vram_gb":-1`, 1),
	} {
		w, _ := post(t, body)
		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), `"bad_request"`) {
			t.Errorf("%s: status %d body %s", name, w.Code, w.Body)
		}
	}
}

func TestCreateReservationEmptyRegionIsNull(t *testing.T) {
	w, _ := post(t, strings.Replace(valid(goodWallet, "o1"), `"region":null`, `"region":""`, 1))
	var res contract.Reservation
	json.Unmarshal(w.Body.Bytes(), &res)
	if w.Code != http.StatusCreated || res.Region != nil || !strings.Contains(res.CanonicalPayload, `"region":null`) {
		t.Fatalf("status %d, reservation %+v", w.Code, res)
	}
}

func TestCreateReservationBodyMessages(t *testing.T) {
	for body, want := range map[string]string{
		`{"gpu_name":"x"}`: "field that the API does not accept",
		`{`:                "not valid JSON",
		`{"request_id":"` + strings.Repeat("a", 1<<17) + `"}`: "too large",
	} {
		w, _ := post(t, body)
		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), want) {
			t.Errorf("status %d body %s, want %q", w.Code, w.Body, want)
		}
	}
}
