package vast

import (
	"encoding/json"
	"errors"
	"math"
	"strings"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// rawOffer holds the Vast.ai fields that api/NOTES.md records.
// A pointer field is nullable or can be missing.
type rawOffer struct {
	ID          json.Number `json:"id"`
	GPUName     string      `json:"gpu_name"`
	NumGPUs     int         `json:"num_gpus"`
	GPURAMMB    float64     `json:"gpu_ram"`
	DPHTotal    float64     `json:"dph_total"`
	Reliability *float64    `json:"reliability2"`
	OldRelia    *float64    `json:"reliability"`
	Geolocation string      `json:"geolocation"`
	DLPerf      *float64    `json:"dlperf"`
	Verified    bool        `json:"verified"`
}

// Drop reasons. Normalize counts each one.
const (
	DropUnparseable    = "unparseable"
	DropNoGPUName      = "no_gpu_name"
	DropBadGPUCount    = "bad_gpu_count"
	DropBadPrice       = "bad_price"
	DropBadReliability = "bad_reliability"
)

// toOffer converts one raw offer. The error text is the drop reason.
func toOffer(raw json.RawMessage) (contract.Offer, error) {
	var r rawOffer
	if err := json.Unmarshal(raw, &r); err != nil {
		return contract.Offer{}, errors.New(DropUnparseable)
	}
	relia := r.Reliability
	if relia == nil {
		relia = r.OldRelia
	}
	switch {
	case strings.TrimSpace(r.GPUName) == "":
		return contract.Offer{}, errors.New(DropNoGPUName)
	case r.NumGPUs < 1:
		return contract.Offer{}, errors.New(DropBadGPUCount)
	case r.DPHTotal <= 0:
		return contract.Offer{}, errors.New(DropBadPrice)
	case relia == nil || *relia < 0 || *relia > 1:
		return contract.Offer{}, errors.New(DropBadReliability)
	}
	gb := math.Round(r.GPURAMMB / 1024) // Vast reports 24564 MiB for a 24 GB card
	o := contract.Offer{
		ID:           r.ID.String(),
		GPUName:      strings.TrimSpace(r.GPUName),
		NumGPUs:      r.NumGPUs,
		GPURAMGB:     gb,
		TotalVRAMGB:  float64(r.NumGPUs) * gb,
		Region:       region(r.Geolocation),
		PricePerHour: r.DPHTotal,
		Reliability:  *relia,
		DLPerf:       r.DLPerf,
		Verified:     r.Verified,
	}
	if r.DLPerf != nil {
		v := *r.DLPerf / r.DPHTotal
		o.PerformancePerDollar = &v
	}
	return o, nil
}

// region returns the part of "Texas, US" after the last comma, or the whole text.
func region(geolocation string) string {
	return strings.TrimSpace(geolocation[strings.LastIndex(geolocation, ",")+1:])
}

// Normalize converts the raw offers. It drops each invalid offer and counts it by reason.
func Normalize(raws []json.RawMessage) ([]contract.Offer, map[string]int) {
	offers := make([]contract.Offer, 0, len(raws))
	drops := map[string]int{}
	for _, raw := range raws {
		o, err := toOffer(raw)
		if err != nil {
			drops[err.Error()]++
			continue
		}
		offers = append(offers, o)
	}
	return offers, drops
}
