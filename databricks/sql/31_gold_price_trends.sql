-- Build solgpu.gold.gpu_price_trends: one row for each snapshot, canonical GPU model, and region
-- with the minimum, p10, median, and p90 hourly price and the listing count. The Explore chart
-- reads the TrendPoint columns (prd.md section 8) plus gpu_name and region.
-- Team convention (same as #96): gold price benchmarks use single-GPU listings only
-- (num_gpus = 1), because price_per_hour is the price of the whole offer. The README section
-- "GPU price index method" depends on this rule for the region = 'all' rows.
-- Each snapshot and model also gets one row with region = 'all' over every region, because
-- the Explore chart shows all regions by default. This doubles the input rows on purpose.
-- Invariant: minimum_price <= p10_price <= median_price <= p90_price in every row, because
-- percentile is exact (not percentile_approx). snapshot_id is an extra last column for the checks.
-- Idempotent: CREATE OR REPLACE rebuilds the table from silver on every run.
-- Run: python dbsql.py --file databricks/sql/31_gold_price_trends.sql, or paste into the SQL editor.

CREATE OR REPLACE TABLE solgpu.gold.gpu_price_trends
USING DELTA
COMMENT 'Hourly price distribution for each snapshot, canonical GPU model, and region (plus region all), single-GPU offers only'
AS
WITH single AS (
  SELECT snapshot_id, captured_at, gpu_name, region, price_per_hour
  FROM solgpu.silver.offers
  WHERE num_gpus = 1
),
with_all AS (
  SELECT snapshot_id, captured_at, gpu_name, region, price_per_hour FROM single
  UNION ALL
  SELECT snapshot_id, captured_at, gpu_name, 'all' AS region, price_per_hour FROM single
)
SELECT
  captured_at AS timestamp,
  gpu_name,
  region,
  min(price_per_hour) AS minimum_price,
  percentile(price_per_hour, 0.1) AS p10_price,
  percentile(price_per_hour, 0.5) AS median_price,
  percentile(price_per_hour, 0.9) AS p90_price,
  count(*) AS listing_count,
  snapshot_id
FROM with_all
GROUP BY snapshot_id, captured_at, gpu_name, region;
