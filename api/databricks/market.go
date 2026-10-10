package databricks

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// goldSchema is the catalog and schema of the gold tables.
// The column names match databricks/sql/30_gold_market_summary.sql and 31_gold_price_trends.sql.
// AllRegions is the region value of the all-regions trend rows.
const AllRegions = "all"

const goldSchema = "solgpu.gold"

const summaryQuery = `SELECT gpu_name, listing_count, lowest_price, median_price, p90_price, median_reliability, updated_at
FROM ` + goldSchema + `.gpu_market_summary
WHERE gpu_name = :gpu_name
ORDER BY updated_at DESC
LIMIT 1`

// A missing region means the rows with region = 'all', which gold.gpu_price_trends holds (#101),
// so a chart never mixes regions.
const trendsQuery = "SELECT `timestamp`, minimum_price, median_price, p10_price, p90_price, listing_count\n" +
	"FROM " + goldSchema + ".gpu_price_trends\n" +
	"WHERE gpu_name = :gpu_name AND region = :region\n" +
	"ORDER BY `timestamp` ASC"

// mediansQuery reads the latest summary row of each GPU in one statement, so a page of offers needs one query.
const mediansQuery = `SELECT gpu_name, median_price
FROM ` + goldSchema + `.gpu_market_summary
QUALIFY ROW_NUMBER() OVER (PARTITION BY gpu_name ORDER BY updated_at DESC) = 1`

// Medians maps each gpu_name to its latest median price.
func Medians(ctx context.Context, q Querier) (map[string]float64, error) {
	res, err := q.Query(ctx, mediansQuery)
	if err != nil {
		return nil, err
	}
	m := make(map[string]float64, len(res.Rows))
	for _, r := range res.Rows {
		if len(r) != 2 {
			return nil, fmt.Errorf("median row has %d columns, want 2", len(r))
		}
		v, err := strconv.ParseFloat(r[1], 64)
		if err != nil {
			return nil, fmt.Errorf("median row: %w", err)
		}
		m[r[0]] = v
	}
	return m, nil
}

// Summary returns the latest summary row of the GPU, or nil when the table has none.
func Summary(ctx context.Context, q Querier, gpuName string) (*contract.MarketSummary, error) {
	res, err := q.Query(ctx, summaryQuery, Param{"gpu_name", gpuName})
	if err != nil {
		return nil, err
	}
	if len(res.Rows) == 0 {
		return nil, nil
	}
	r := res.Rows[0]
	if len(r) != 7 {
		return nil, fmt.Errorf("summary row has %d columns, want 7", len(r))
	}
	s := contract.MarketSummary{GPUName: r[0]}
	var errs [6]error
	s.ListingCount, errs[0] = strconv.Atoi(r[1])
	s.LowestPrice, errs[1] = strconv.ParseFloat(r[2], 64)
	s.MedianPrice, errs[2] = strconv.ParseFloat(r[3], 64)
	s.P90Price, errs[3] = strconv.ParseFloat(r[4], 64)
	s.MedianReliability, errs[4] = strconv.ParseFloat(r[5], 64)
	s.UpdatedAt, errs[5] = rfc3339(r[6])
	for _, e := range errs {
		if e != nil {
			return nil, fmt.Errorf("summary row: %w", e)
		}
	}
	return &s, nil
}

// Trends returns the points in time order.
func Trends(ctx context.Context, q Querier, gpuName, region string) ([]contract.TrendPoint, error) {
	if region == "" {
		region = AllRegions
	}
	res, err := q.Query(ctx, trendsQuery, Param{"gpu_name", gpuName}, Param{"region", region})
	if err != nil {
		return nil, err
	}
	points := make([]contract.TrendPoint, 0, len(res.Rows))
	for _, r := range res.Rows {
		if len(r) != 6 {
			return nil, fmt.Errorf("trend row has %d columns, want 6", len(r))
		}
		var p contract.TrendPoint
		var errs [6]error
		p.Timestamp, errs[0] = rfc3339(r[0])
		p.MinimumPrice, errs[1] = strconv.ParseFloat(r[1], 64)
		p.MedianPrice, errs[2] = strconv.ParseFloat(r[2], 64)
		p.P10Price, errs[3] = strconv.ParseFloat(r[3], 64)
		p.P90Price, errs[4] = strconv.ParseFloat(r[4], 64)
		p.ListingCount, errs[5] = strconv.Atoi(r[5])
		for _, e := range errs {
			if e != nil {
				return nil, fmt.Errorf("trend row: %w", e)
			}
		}
		points = append(points, p)
	}
	return points, nil
}

// rfc3339 turns a warehouse timestamp into RFC 3339 UTC. A value with no zone is UTC.
func rfc3339(s string) (string, error) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05.999999999", "2006-01-02T15:04:05.999999999"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC().Format(time.RFC3339), nil
		}
	}
	return "", fmt.Errorf("bad timestamp %q", s)
}

const (
	summaryTimeQuery = "SELECT MAX(updated_at) FROM " + goldSchema + ".gpu_market_summary"
	trendsTimeQuery  = "SELECT MAX(`timestamp`) FROM " + goldSchema + ".gpu_price_trends"
)

// SummaryUpdatedAt returns the newest updated_at of the summary table. It is the data time
// for a GPU that has no row. A NULL or an empty table is an error.
func SummaryUpdatedAt(ctx context.Context, q Querier) (string, error) {
	return latest(ctx, q, summaryTimeQuery)
}

// TrendsUpdatedAt returns the newest timestamp of the trend table, with the same rules.
func TrendsUpdatedAt(ctx context.Context, q Querier) (string, error) {
	return latest(ctx, q, trendsTimeQuery)
}

func latest(ctx context.Context, q Querier, statement string) (string, error) {
	res, err := q.Query(ctx, statement)
	if err != nil {
		return "", err
	}
	if len(res.Rows) != 1 || len(res.Rows[0]) != 1 || res.Rows[0][0] == "" {
		return "", errors.New("the table has no data time")
	}
	return rfc3339(res.Rows[0][0])
}
