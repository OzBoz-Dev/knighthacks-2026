// Package contract holds the Go structs for the frozen types in prd.md section 8.
// The JSON tags match frontend-digi/lib/api/types.ts. A nullable field is a pointer.
package contract

// Offer is one normalized Vast.ai offer. Reliability is a ratio from 0 to 1.
type Offer struct {
	ID                   string   `json:"id"`
	GPUName              string   `json:"gpu_name"`
	NumGPUs              int      `json:"num_gpus"`
	GPURAMGB             float64  `json:"gpu_ram_gb"`
	TotalVRAMGB          float64  `json:"total_vram_gb"`
	Region               string   `json:"region"`
	PricePerHour         float64  `json:"price_per_hour"`
	Reliability          float64  `json:"reliability"`
	DLPerf               *float64 `json:"dlperf"`
	PerformancePerDollar *float64 `json:"performance_per_dollar"`
	Verified             bool     `json:"verified"`
	MarketPositionPct    *float64 `json:"market_position_pct"`
	PricePercentile      *float64 `json:"price_percentile"`
}

type MarketSummary struct {
	GPUName           string  `json:"gpu_name"`
	ListingCount      int     `json:"listing_count"`
	LowestPrice       float64 `json:"lowest_price"`
	MedianPrice       float64 `json:"median_price"`
	P90Price          float64 `json:"p90_price"`
	MedianReliability float64 `json:"median_reliability"`
	UpdatedAt         string  `json:"updated_at"`
}

type TrendPoint struct {
	Timestamp    string  `json:"timestamp"`
	MinimumPrice float64 `json:"minimum_price"`
	MedianPrice  float64 `json:"median_price"`
	P10Price     float64 `json:"p10_price"`
	P90Price     float64 `json:"p90_price"`
	ListingCount int     `json:"listing_count"`
}

type Priority string

const (
	PriorityCheapest    Priority = "cheapest"
	PriorityBalanced    Priority = "balanced"
	PriorityPerformance Priority = "performance"
)

// MatchRequest is the body of POST /api/match. MinReliability is a ratio from 0 to 1.
type MatchRequest struct {
	MinVRAMGB       float64  `json:"min_vram_gb"`
	MaxPricePerHour float64  `json:"max_price_per_hour"`
	MinReliability  float64  `json:"min_reliability"`
	Priority        Priority `json:"priority"`
	GPUNames        []string `json:"gpu_names,omitempty"`
	Region          string   `json:"region,omitempty"`
}

type ScoreBreakdown struct {
	Price       float64 `json:"price"`
	Performance float64 `json:"performance"`
	Reliability float64 `json:"reliability"`
}

type Recommendation struct {
	Rank           int            `json:"rank"`
	Offer          Offer          `json:"offer"`
	Score          float64        `json:"score"`
	ScoreBreakdown ScoreBreakdown `json:"score_breakdown"`
	Explanations   []string       `json:"explanations"`
}

// Excluded counts the first filter that each offer fails, in the PRD section 5.2 order.
type Excluded struct {
	GPUModel    int `json:"gpu_model"`
	Region      int `json:"region"`
	VRAM        int `json:"vram"`
	Reliability int `json:"reliability"`
	Budget      int `json:"budget"`
}

type MatchResponse struct {
	RequestID       string           `json:"request_id"`
	SnapshotID      string           `json:"snapshot_id"`
	Checked         int              `json:"checked"`
	Eligible        int              `json:"eligible"`
	Excluded        Excluded         `json:"excluded"`
	Recommendations []Recommendation `json:"recommendations"`
}

type ReservationStatus string

const (
	StatusPending   ReservationStatus = "pending"
	StatusConfirmed ReservationStatus = "confirmed"
	StatusFailed    ReservationStatus = "failed"
)

type Reservation struct {
	ID               string            `json:"id"`
	RequestID        string            `json:"request_id"`
	SnapshotID       string            `json:"snapshot_id"`
	OfferID          string            `json:"offer_id"`
	Wallet           string            `json:"wallet"`
	GPUName          string            `json:"gpu_name"`
	PricePerHour     float64           `json:"price_per_hour"`
	MinVRAMGB        float64           `json:"min_vram_gb"`
	MaxPricePerHour  float64           `json:"max_price_per_hour"`
	Priority         string            `json:"priority"`
	Region           *string           `json:"region"`
	CreatedAt        string            `json:"created_at"`
	CanonicalPayload string            `json:"canonical_payload"`
	PayloadHash      string            `json:"payload_hash"`
	Status           ReservationStatus `json:"status"`
	Signature        *string           `json:"signature"`
	Slot             *uint64           `json:"slot"`
}

// Source names where the data in an Envelope comes from. The values follow the #26 proposal.
type Source string

const (
	SourceVastLive         Source = "vast-live"
	SourceVastSaved        Source = "vast-saved"
	SourceDatabricksLive   Source = "databricks-live"
	SourceDatabricksExport Source = "databricks-export"
)

// Envelope wraps the read endpoints: offers, market summary, and market trends.
// CapturedAt is the original capture time in RFC 3339 UTC, never the fetch time.
type Envelope[T any] struct {
	Source     Source  `json:"source"`
	CapturedAt string  `json:"captured_at"`
	SnapshotID *string `json:"snapshot_id"`
	Data       T       `json:"data"`
}
