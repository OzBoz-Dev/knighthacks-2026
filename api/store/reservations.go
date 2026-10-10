package store

import (
	"database/sql"
	"errors"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// ErrNotFound means no reservation has the ID.
var ErrNotFound = errors.New("reservation not found")

// ErrNotPending means the reservation is no longer pending, so a mark must not change it.
var ErrNotPending = errors.New("reservation is not pending")

const columns = `id, request_id, snapshot_id, offer_id, wallet, gpu_name, price_per_hour, min_vram_gb,
	max_price_per_hour, priority, region, created_at, canonical_payload, payload_hash, status, signature, slot`

// Create stores the reservation.
func Create(db *sql.DB, r contract.Reservation) error {
	_, err := db.Exec(`INSERT INTO reservations (`+columns+`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		r.ID, r.RequestID, r.SnapshotID, r.OfferID, r.Wallet, r.GPUName, r.PricePerHour, r.MinVRAMGB,
		r.MaxPricePerHour, r.Priority, r.Region, r.CreatedAt, r.CanonicalPayload, r.PayloadHash, r.Status, r.Signature, r.Slot)
	return err
}

type scanner interface{ Scan(...any) error }

func scan(s scanner) (r contract.Reservation, err error) {
	err = s.Scan(&r.ID, &r.RequestID, &r.SnapshotID, &r.OfferID, &r.Wallet, &r.GPUName, &r.PricePerHour, &r.MinVRAMGB,
		&r.MaxPricePerHour, &r.Priority, &r.Region, &r.CreatedAt, &r.CanonicalPayload, &r.PayloadHash, &r.Status, &r.Signature, &r.Slot)
	return
}

// Get returns the reservation, or ErrNotFound.
func Get(db *sql.DB, id string) (contract.Reservation, error) {
	r, err := scan(db.QueryRow(`SELECT `+columns+` FROM reservations WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return r, ErrNotFound
	}
	return r, err
}

// ListByWallet returns the wallet reservations, newest first. The ID breaks a tie in the same order every time.
func ListByWallet(db *sql.DB, wallet string) ([]contract.Reservation, error) {
	rows, err := db.Query(`SELECT `+columns+` FROM reservations WHERE wallet = ? ORDER BY created_at DESC, id DESC`, wallet)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []contract.Reservation{}
	for rows.Next() {
		r, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// MarkConfirmed sets the status to confirmed and stores the signature and the slot.
func MarkConfirmed(db *sql.DB, id, signature string, slot uint64) error {
	return mark(db, id, contract.StatusConfirmed, signature, slot)
}

// MarkFailed sets the status to failed.
func MarkFailed(db *sql.DB, id string) error {
	return mark(db, id, contract.StatusFailed, nil, nil)
}

func mark(db *sql.DB, id string, status contract.ReservationStatus, signature, slot any) error {
	res, err := db.Exec(`UPDATE reservations SET status = ?, signature = ?, slot = ? WHERE id = ? AND status = 'pending'`,
		status, signature, slot, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 1 {
		return nil
	}
	if _, err := Get(db, id); err != nil {
		return err
	}
	return ErrNotPending
}
