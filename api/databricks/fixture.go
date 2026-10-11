package databricks

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// Export is the gold export file, fixtures/databricks_market.json. Format until #21 fixes it:
//
//	{"exported_at": "<RFC3339>", "snapshot_id": "<id or null>",
//	 "summaries": [MarketSummary...],
//	 "trends": [{"gpu_name", "region", ...TrendPoint fields}]}
type Export struct {
	ExportedAt string                   `json:"exported_at"`
	SnapshotID *string                  `json:"snapshot_id"`
	Summaries  []contract.MarketSummary `json:"summaries"`
	Trends     []ExportTrend            `json:"trends"`
}

// ExportTrend is one trend point with the keys that the endpoint filters on.
type ExportTrend struct {
	GPUName string `json:"gpu_name"`
	Region  string `json:"region"`
	contract.TrendPoint
}

// LoadExport reads and checks the export file.
func LoadExport(path string) (*Export, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read export: %w", err)
	}
	var e Export
	if err := json.Unmarshal(b, &e); err != nil {
		return nil, fmt.Errorf("parse export: %w", err)
	}
	if _, err := time.Parse(time.RFC3339, e.ExportedAt); err != nil {
		return nil, fmt.Errorf("export exported_at: %w", err)
	}
	return &e, nil
}

// Summary returns the summary of the GPU, or nil when the export has none.
func (e *Export) Summary(gpuName string) *contract.MarketSummary {
	for i := range e.Summaries {
		if e.Summaries[i].GPUName == gpuName {
			return &e.Summaries[i]
		}
	}
	return nil
}

// Medians maps each gpu_name of the export to its median price.
// shortcut: the export keys by the canonical name and holds no name map, so a raw Vast.ai name such as
// "A100 PCIE" finds no median, upgrade when #21 adds the gpu_name_map rows to the export.
func (e *Export) Medians() map[string]float64 {
	m := make(map[string]float64, len(e.Summaries))
	for _, s := range e.Summaries {
		m[s.GPUName] = s.MedianPrice
	}
	return m
}

// TrendPoints returns the points of the GPU in time order. An empty region means the rows with region "all".
func (e *Export) TrendPoints(gpuName, region string) []contract.TrendPoint {
	if region == "" {
		region = AllRegions
	}
	points := []contract.TrendPoint{}
	for _, t := range e.Trends {
		if t.GPUName == gpuName && t.Region == region {
			points = append(points, t.TrendPoint)
		}
	}
	slices.SortStableFunc(points, func(a, b contract.TrendPoint) int { return strings.Compare(a.Timestamp, b.Timestamp) })
	return points
}
