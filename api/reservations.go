package main

import (
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
