package main

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"encoding/json"

	"github.com/gagliardetto/solana-go/rpc"

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

// The values that the recorded transactions in solana/testdata hold.
const (
	txGoodSig   = "3C2a9AcSpgQkUPxsbQ7mxvdtzfLmvkb6efFACaxVyinEevv9g19CEMQbu79gWVFeu3PVHPYphaEPekaYcGumMpyM"
	txFailedSig = "2L5QXv1Aj3oUfy6eDFz5tsBjT1m97A21e5zk5z8vwxU1yCRULWRa66tAHmPj27TegCWPv6puw9Kq87fnKZcH9Mqt"
	txWallet    = "GNN5rHKgxkUE3zCdrZxgPmciLSiVRezCpQVyNW2W4Zk3"
	txResID     = "3b1f8c2a-6d4e-4f7a-9c0b-2e5d8a1f4c6b"
	txHash      = "8675af8fe6185424cf3f4b29027aa829bf4735064d18879d698fcaa91f6e8ecc"
)

// recordedRPC starts a devnet RPC server that returns the recorded file, or a 500 for an empty name.
// calls counts the requests.
func recordedRPC(t *testing.T, file string) (client *rpc.Client, calls *int) {
	t.Helper()
	var body []byte
	if file != "" {
		var err error
		if body, err = os.ReadFile("solana/testdata/" + file); err != nil {
			t.Fatal(err)
		}
	}
	calls = new(int)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*calls++
		if body == nil {
			http.Error(w, "node down", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return rpc.New(srv.URL), calls
}

// pendingDB stores the pending reservation that the recorded transactions sign.
func pendingDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Create(db, contract.Reservation{ID: txResID, RequestID: "req_1", SnapshotID: "snap_1", OfferID: "o1",
		Wallet: txWallet, GPUName: "RTX 4090", PricePerHour: 0.42, MinVRAMGB: 24, MaxPricePerHour: 1, Priority: "balanced",
		CreatedAt: "2026-10-10T20:05:00.000Z", CanonicalPayload: "{}", PayloadHash: txHash, Status: contract.StatusPending}); err != nil {
		t.Fatal(err)
	}
	return db
}

func confirm(t *testing.T, db *sql.DB, chain *rpc.Client, id, body string) (int, confirmResponse) {
	t.Helper()
	mux := http.NewServeMux()
	mux.Handle("POST /api/reservations/{id}/confirm", confirmReservation(db, chain))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/reservations/"+id+"/confirm", strings.NewReader(body)))
	var resp confirmResponse
	if w.Code == http.StatusOK {
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatal(err)
		}
	} else if !strings.Contains(w.Body.String(), `"error"`) {
		t.Fatalf("status %d with no error shape: %s", w.Code, w.Body)
	}
	return w.Code, resp
}

func TestConfirmReservation(t *testing.T) {
	db := pendingDB(t)
	chain, calls := recordedRPC(t, "get_transaction_good.json")
	code, resp := confirm(t, db, chain, txResID, `{"signature":"`+txGoodSig+`"}`)
	if code != http.StatusOK || resp.Status != contract.StatusConfirmed || resp.Signature == nil || *resp.Signature != txGoodSig ||
		resp.Slot == nil || *resp.Slot != 418392215 || resp.FailedChecks == nil || len(resp.FailedChecks) != 0 || resp.ID != txResID {
		t.Fatalf("status %d response %+v", code, resp)
	}
	if got, _ := store.Get(db, txResID); got.Status != contract.StatusConfirmed || *got.Slot != 418392215 {
		t.Fatalf("stored %+v", got)
	}

	// A repeat call returns the same result and makes no RPC call.
	code, again := confirm(t, db, chain, txResID, `{"signature":"`+txGoodSig+`"}`)
	if code != http.StatusOK || *calls != 1 || again.Status != resp.Status || *again.Signature != *resp.Signature || *again.Slot != *resp.Slot {
		t.Fatalf("repeat: status %d, %d calls, %+v", code, *calls, again)
	}
}

func TestConfirmReservationFailedCheck(t *testing.T) {
	db := pendingDB(t)
	chain, _ := recordedRPC(t, "get_transaction_failed.json")
	code, resp := confirm(t, db, chain, txResID, `{"signature":"`+txFailedSig+`"}`)
	if code != http.StatusOK || resp.Status != contract.StatusFailed || len(resp.FailedChecks) != 1 || resp.FailedChecks[0] != "confirmed" ||
		resp.Signature != nil {
		t.Fatalf("status %d response %+v", code, resp)
	}
	if got, _ := store.Get(db, txResID); got.Status != contract.StatusFailed {
		t.Fatalf("stored %+v", got)
	}
	// A repeat call gives the same result.
	if code, again := confirm(t, db, chain, txResID, `{"signature":"`+txFailedSig+`"}`); code != http.StatusOK ||
		again.Status != contract.StatusFailed || len(again.FailedChecks) != 1 {
		t.Fatalf("repeat: status %d response %+v", code, again)
	}
}

func TestConfirmReservationErrors(t *testing.T) {
	db := pendingDB(t)
	good, _ := recordedRPC(t, "get_transaction_good.json")
	down, _ := recordedRPC(t, "")
	for name, tc := range map[string]struct {
		chain *rpc.Client
		id    string
		body  string
		want  int
	}{
		"unknown id":        {good, "res_none", `{"signature":"` + txGoodSig + `"}`, http.StatusNotFound},
		"bad signature":     {good, txResID, `{"signature":"abc"}`, http.StatusBadRequest},
		"missing signature": {good, txResID, `{}`, http.StatusBadRequest},
		"not json":          {good, txResID, `signature`, http.StatusBadRequest},
		"rpc down":          {down, txResID, `{"signature":"` + txGoodSig + `"}`, http.StatusServiceUnavailable},
	} {
		if code, _ := confirm(t, db, tc.chain, tc.id, tc.body); code != tc.want {
			t.Errorf("%s: status %d, want %d", name, code, tc.want)
		}
	}
	if got, _ := store.Get(db, txResID); got.Status != contract.StatusPending {
		t.Fatalf("an error must not change the reservation: %+v", got)
	}
}

func TestListReservations(t *testing.T) {
	db := pendingDB(t)
	for _, r := range []contract.Reservation{
		{ID: "res_new", CreatedAt: "2026-10-10T20:10:00.000Z"},
		{ID: "res_old", CreatedAt: "2026-10-10T19:00:00.000Z"},
		{ID: "res_other", CreatedAt: "2026-10-10T21:00:00.000Z", Wallet: goodWallet},
	} {
		if r.Wallet == "" {
			r.Wallet = txWallet
		}
		r.Status = contract.StatusPending
		if err := store.Create(db, r); err != nil {
			t.Fatal(err)
		}
	}
	mux := http.NewServeMux()
	mux.Handle("GET /api/reservations", listReservations(db))

	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/reservations?wallet="+txWallet, nil))
	var list []contract.Reservation
	json.Unmarshal(w.Body.Bytes(), &list)
	if w.Code != http.StatusOK || len(list) != 3 || list[0].ID != "res_new" || list[1].ID != txResID || list[2].ID != "res_old" {
		t.Fatalf("status %d body %s", w.Code, w.Body)
	}

	w = httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/reservations?wallet=other", nil))
	if w.Code != http.StatusOK || strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatalf("no reservations: status %d body %s", w.Code, w.Body)
	}

	for _, url := range []string{"/api/reservations", "/api/reservations?wallet=%20"} {
		w = httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, url, nil))
		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), `"bad_request"`) {
			t.Fatalf("%s: status %d body %s", url, w.Code, w.Body)
		}
	}
}

func verify(t *testing.T, db *sql.DB, chain *rpc.Client, id string) (int, string) {
	t.Helper()
	mux := http.NewServeMux()
	mux.Handle("GET /api/reservations/{id}/verify", verifyReservation(db, chain))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/reservations/"+id+"/verify", nil))
	return w.Code, w.Body.String()
}

func TestVerifyReservation(t *testing.T) {
	db := pendingDB(t)
	chain, _ := recordedRPC(t, "get_transaction_good.json")
	if err := store.MarkConfirmed(db, txResID, txGoodSig, 418392215); err != nil {
		t.Fatal(err)
	}
	code, body := verify(t, db, chain, txResID)
	var resp struct {
		ReservationID string  `json:"reservation_id"`
		Signature     string  `json:"signature"`
		Slot          *uint64 `json:"slot"`
		Checks        []struct {
			Name   string `json:"name"`
			Passed bool   `json:"passed"`
			Detail string `json:"detail"`
		} `json:"checks"`
	}
	json.Unmarshal([]byte(body), &resp)
	names := []string{"exists", "signer", "reservation_id", "memo_hash", "confirmed"}
	if code != http.StatusOK || resp.ReservationID != txResID || resp.Signature != txGoodSig || resp.Slot == nil ||
		*resp.Slot != 418392215 || len(resp.Checks) != len(names) {
		t.Fatalf("status %d body %s", code, body)
	}
	for i, c := range resp.Checks {
		if c.Name != names[i] || !c.Passed {
			t.Errorf("check %d = %+v", i, c)
		}
	}
	if got, _ := store.Get(db, txResID); got.Status != contract.StatusConfirmed {
		t.Fatalf("verify must not change the reservation: %+v", got)
	}
}

func TestVerifyReservationErrors(t *testing.T) {
	good, _ := recordedRPC(t, "get_transaction_good.json")
	down, _ := recordedRPC(t, "")
	pending := pendingDB(t)
	if code, body := verify(t, pending, good, "res_none"); code != http.StatusNotFound || !strings.Contains(body, `"not_found"`) {
		t.Fatalf("unknown id: %d %s", code, body)
	}
	if code, body := verify(t, pending, good, txResID); code != http.StatusBadRequest || !strings.Contains(body, "no signature") {
		t.Fatalf("no signature: %d %s", code, body)
	}
	store.MarkConfirmed(pending, txResID, txGoodSig, 418392215)
	if code, body := verify(t, pending, down, txResID); code != http.StatusServiceUnavailable || !strings.Contains(body, `"upstream_unavailable"`) {
		t.Fatalf("rpc down: %d %s", code, body)
	}
}
