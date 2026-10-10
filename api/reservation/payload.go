// Package reservation builds the canonical payload, its hash, and the memo.
package reservation

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// MemoPrefix starts every memo. PRD 5.3 sets CX1. Issues #2 and #41 may change it.
const MemoPrefix = "CX1"

// Payload returns the canonical payload and its SHA-256 hash in lowercase hex.
// The payload comes from a map, so json.Marshal sorts the keys. A struct would keep its field order.
func Payload(r contract.Reservation) (payload, hash string, err error) {
	b, err := json.Marshal(map[string]any{
		"id":                 r.ID,
		"request_id":         r.RequestID,
		"snapshot_id":        r.SnapshotID,
		"offer_id":           r.OfferID,
		"wallet":             r.Wallet,
		"gpu_name":           r.GPUName,
		"price_per_hour":     r.PricePerHour,
		"min_vram_gb":        r.MinVRAMGB,
		"max_price_per_hour": r.MaxPricePerHour,
		"priority":           r.Priority,
		"region":             r.Region,
		"created_at":         r.CreatedAt,
	})
	if err != nil {
		return "", "", err
	}
	sum := sha256.Sum256(b)
	return string(b), hex.EncodeToString(sum[:]), nil
}

// Memo returns the Solana Memo text: <prefix>|<reservation_id>|<payload_hash>.
func Memo(reservationID, payloadHash string) string {
	return MemoPrefix + "|" + reservationID + "|" + payloadHash
}
