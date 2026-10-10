package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gagliardetto/solana-go"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
	"github.com/OzBoz-Dev/knighthacks-2026/api/httpx"
	"github.com/OzBoz-Dev/knighthacks-2026/api/reservation"
	solanaverify "github.com/OzBoz-Dev/knighthacks-2026/api/solana"
	"github.com/OzBoz-Dev/knighthacks-2026/api/store"
)

// OfferLookup finds an offer in the snapshot. It reports false when the snapshot or the offer is unknown.
type OfferLookup interface {
	Offer(snapshotID, offerID string) (contract.Offer, bool)
}

// createdAtFormat has fixed-width milliseconds, so the text order of created_at is the time order.
const createdAtFormat = "2006-01-02T15:04:05.000Z"

type createReservationRequest struct {
	RequestID       string  `json:"request_id"`
	SnapshotID      string  `json:"snapshot_id"`
	OfferID         string  `json:"offer_id"`
	Wallet          string  `json:"wallet"`
	MinVRAMGB       float64 `json:"min_vram_gb"`
	MaxPricePerHour float64 `json:"max_price_per_hour"`
	Priority        string  `json:"priority"`
	Region          *string `json:"region"`
}

// createReservation handles POST /api/reservations. It stores a pending reservation.
// The GPU name and the price come from the offer, never from the request.
func createReservation(db *sql.DB, offers OfferLookup) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bad := func(msg string) { httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, msg) }
		var req createReservationRequest
		if !decodeBody(w, r, &req) {
			return
		}
		switch {
		case req.RequestID == "" || req.SnapshotID == "" || req.OfferID == "":
			bad("request_id, snapshot_id, and offer_id are required.")
			return
		case req.MinVRAMGB < 0 || req.MaxPricePerHour <= 0:
			bad("min_vram_gb must not be negative and max_price_per_hour must be above zero.")
			return
		case req.Priority != string(contract.PriorityCheapest) && req.Priority != string(contract.PriorityBalanced) &&
			req.Priority != string(contract.PriorityPerformance):
			bad("priority must be cheapest, balanced, or performance.")
			return
		}
		if _, err := solana.PublicKeyFromBase58(req.Wallet); err != nil {
			bad("The wallet is not a valid Solana address.")
			return
		}
		offer, ok := offers.Offer(req.SnapshotID, req.OfferID)
		if !ok {
			bad("The offer is not in that snapshot.")
			return
		}
		if req.Region != nil && *req.Region == "" {
			req.Region = nil
		}
		id, err := newID("res_")
		if err != nil {
			slog.Error("reservation id", "err", err)
			httpx.WriteError(w, http.StatusInternalServerError, httpx.CodeInternal, "The reservation failed. Try again.")
			return
		}
		res := contract.Reservation{
			ID: id, RequestID: req.RequestID, SnapshotID: req.SnapshotID, OfferID: offer.ID, Wallet: req.Wallet,
			GPUName: offer.GPUName, PricePerHour: offer.PricePerHour, MinVRAMGB: req.MinVRAMGB,
			MaxPricePerHour: req.MaxPricePerHour, Priority: req.Priority, Region: req.Region,
			CreatedAt: time.Now().UTC().Format(createdAtFormat), Status: contract.StatusPending,
		}
		if res.CanonicalPayload, res.PayloadHash, err = reservation.Payload(res); err == nil {
			err = store.Create(db, res)
		}
		if err != nil {
			slog.Error("create reservation", "err", err)
			httpx.WriteError(w, http.StatusInternalServerError, httpx.CodeInternal, "The reservation failed. Try again.")
			return
		}
		httpx.WriteJSON(w, http.StatusCreated, res)
	}
}

// newID returns prefix and 16 random hex characters, for example res_8c1d2e3f4a5b6c7d.
func newID(prefix string) (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(b), nil
}

// decodeBody reads one JSON object of at most 64 KiB that has no unknown field.
// On an error it writes the 400 response and returns false.
func decodeBody(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16))
	dec.DisallowUnknownFields()
	err := dec.Decode(v)
	if err == nil {
		return true
	}
	msg := "The request body is not valid JSON."
	var typeErr *json.UnmarshalTypeError
	switch {
	case errors.As(err, new(*http.MaxBytesError)):
		msg = "The request body is too large."
	case strings.HasPrefix(err.Error(), "json: unknown field"):
		msg = "The request has a field that the API does not accept."
	case errors.As(err, &typeErr) && typeErr.Field != "":
		msg = typeErr.Field + " has the wrong type."
	}
	httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, msg)
	return false
}

// rpcTimeout bounds one devnet RPC call, so a slow node cannot hold a request.
const rpcTimeout = 10 * time.Second

// confirmResponse is the Reservation with the names of the checks that failed.
type confirmResponse struct {
	contract.Reservation
	FailedChecks []string `json:"failed_checks"`
}

// confirmReservation handles POST /api/reservations/{id}/confirm. It checks the memo transaction on devnet.
// It confirms the reservation only when every check passes. A confirmed reservation returns with no RPC call.
func confirmReservation(db *sql.DB, chain solanaverify.TxGetter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Signature string `json:"signature"`
		}
		if !decodeBody(w, r, &body) {
			return
		}
		if _, err := solana.SignatureFromBase58(body.Signature); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, "The signature is not a valid Solana transaction signature.")
			return
		}
		res, ok := getReservation(w, db, r.PathValue("id"))
		if !ok {
			return
		}
		if res.Signature != nil && *res.Signature != body.Signature {
			msg := "This reservation is already confirmed with another signature."
			if res.Status == contract.StatusFailed {
				msg = "This reservation already failed with another signature. Reserve the offer again."
			}
			httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, msg)
			return
		}
		if res.Status == contract.StatusConfirmed {
			httpx.WriteJSON(w, http.StatusOK, confirmResponse{res, []string{}})
			return
		}
		// A failed reservation runs the checks again only to name the failed checks. Its status stays.
		ctx, cancel := context.WithTimeout(r.Context(), rpcTimeout)
		defer cancel()
		result, err := solanaverify.Verify(ctx, chain, body.Signature, expected(res))
		if err != nil {
			slog.Error("confirm: devnet check", "id", res.ID, "err", err)
			httpx.WriteError(w, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "Solana devnet did not answer. Try again in a minute.")
			return
		}
		// Devnet can return the transaction after the wallet reports it, so a missing transaction stays pending.
		if res.Status == contract.StatusPending && !result.Checks[0].Passed { // Checks[0] is solanaverify.CheckExists
			slog.Warn("confirm: transaction not found yet", "id", res.ID)
			httpx.WriteError(w, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "Solana devnet hasn't returned your transaction yet. Try again in a few seconds.")
			return
		}
		failed := []string{}
		for _, c := range result.Checks {
			if !c.Passed {
				failed = append(failed, c.Name)
			}
		}
		switch {
		case res.Status == contract.StatusFailed && len(failed) == 0:
			// The checks of one transaction do not change, so devnet changed its answer. Never send an empty list here.
			slog.Error("confirm: a failed reservation now passes every check", "id", res.ID)
			httpx.WriteError(w, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "Solana devnet gave a different result. Try again in a minute.")
			return
		case res.Status == contract.StatusFailed:
		case len(failed) == 0:
			err = store.MarkConfirmed(db, res.ID, body.Signature, *result.Slot)
		default:
			err = store.MarkFailed(db, res.ID, body.Signature)
		}
		// ErrNotPending: a second call marked it first. The stored status stays.
		if err != nil && !errors.Is(err, store.ErrNotPending) {
			slog.Error("confirm: store", "id", res.ID, "err", err)
			httpx.WriteError(w, http.StatusInternalServerError, httpx.CodeInternal, "The confirmation failed. Try again.")
			return
		}
		if res, ok = getReservation(w, db, res.ID); ok {
			httpx.WriteJSON(w, http.StatusOK, confirmResponse{res, failed})
		}
	}
}

// getReservation reads the reservation. On an error it writes the 404 or 500 response and returns false.
func getReservation(w http.ResponseWriter, db *sql.DB, id string) (contract.Reservation, bool) {
	res, err := store.Get(db, id)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, httpx.CodeNotFound, "No reservation has that ID.")
		return res, false
	}
	if err != nil {
		slog.Error("get reservation", "id", id, "err", err)
		httpx.WriteError(w, http.StatusInternalServerError, httpx.CodeInternal, "The reservation could not be read. Try again.")
		return res, false
	}
	return res, true
}

// expected gives the values from the stored reservation that the devnet memo must match.
func expected(res contract.Reservation) solanaverify.Expected {
	return solanaverify.Expected{Prefix: reservation.MemoPrefix, ReservationID: res.ID, Wallet: res.Wallet, PayloadHash: res.PayloadHash}
}

// listReservations handles GET /api/reservations?wallet=. It returns the wallet reservations, newest first.
func listReservations(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		wallet := strings.TrimSpace(r.URL.Query().Get("wallet"))
		if wallet == "" {
			httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, "wallet is required.")
			return
		}
		list, err := store.ListByWallet(db, wallet)
		if err != nil {
			slog.Error("list reservations", "err", err)
			httpx.WriteError(w, http.StatusInternalServerError, httpx.CodeInternal, "Your reservations could not be read. Try again.")
			return
		}
		httpx.WriteJSON(w, http.StatusOK, list)
	}
}

// verifyResponse has one row per devnet check, in the order of the solana package.
type verifyResponse struct {
	ReservationID string               `json:"reservation_id"`
	Signature     string               `json:"signature"`
	Slot          *uint64              `json:"slot"`
	Checks        []solanaverify.Check `json:"checks"`
}

// verifyReservation handles GET /api/reservations/{id}/verify. It runs the devnet checks again
// against the stored payload and signature. It does not change the reservation.
func verifyReservation(db *sql.DB, chain solanaverify.TxGetter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, ok := getReservation(w, db, r.PathValue("id"))
		if !ok {
			return
		}
		if res.Signature == nil {
			msg := "This reservation has no signature yet. Sign and confirm it first."
			if res.Status == contract.StatusFailed { // a failed row from before the API stored the signature
				msg = "This reservation failed verification. Reserve the offer again."
			}
			httpx.WriteError(w, http.StatusBadRequest, httpx.CodeBadRequest, msg)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), rpcTimeout)
		defer cancel()
		result, err := solanaverify.Verify(ctx, chain, *res.Signature, expected(res))
		if err != nil {
			slog.Error("verify: devnet check", "id", res.ID, "err", err)
			httpx.WriteError(w, http.StatusServiceUnavailable, httpx.CodeUpstreamUnavailable, "Solana devnet did not answer. Try again in a minute.")
			return
		}
		httpx.WriteJSON(w, http.StatusOK, verifyResponse{res.ID, *res.Signature, result.Slot, result.Checks})
	}
}
