package vast

import (
	"encoding/json"
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

// toOffer converts one raw offer. It does not check that the values are valid.
func toOffer(raw json.RawMessage) (contract.Offer, error) {
	var r rawOffer
	if err := json.Unmarshal(raw, &r); err != nil {
		return contract.Offer{}, err
	}
	relia := r.Reliability
	if relia == nil {
		relia = r.OldRelia
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
		DLPerf:       r.DLPerf,
		Verified:     r.Verified,
	}
	if relia != nil {
		o.Reliability = *relia
	}
	if r.DLPerf != nil && r.DPHTotal > 0 {
		v := *r.DLPerf / r.DPHTotal
		o.PerformancePerDollar = &v
	}
	return o, nil
}

// region returns the part of "Texas, US" after the last comma, or the whole text.
func region(geolocation string) string {
	return strings.TrimSpace(geolocation[strings.LastIndex(geolocation, ",")+1:])
}

// Normalize converts the raw offers. It skips an offer that is not valid JSON.
func Normalize(raws []json.RawMessage) []contract.Offer {
	offers := make([]contract.Offer, 0, len(raws))
	for _, raw := range raws {
		if o, err := toOffer(raw); err == nil {
			offers = append(offers, o)
		}
	}
	return offers
}
