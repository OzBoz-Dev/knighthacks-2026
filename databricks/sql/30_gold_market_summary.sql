-- Build solgpu.gold.gpu_market_summary: one row for each canonical GPU model in the latest
-- silver snapshot. The columns match MarketSummary in prd.md section 8, plus snapshot_id as
-- an extra last column for the dashboard and the checks in #121. The API selects the
-- contract columns only and formats the numbers; this table rounds nothing.
-- Team rule for every gold price benchmark (decided by P4, same rule as the README section
-- "GPU price index method"): single-GPU offers only, num_gpus = 1, because price_per_hour is
-- the price of the whole offer and a median over mixed 1x and 8x offers has no meaning.
-- listing_count therefore counts the single-GPU offers of the model in the latest snapshot.
-- Latest snapshot = max(captured_at) in solgpu.silver.offers. updated_at is that capture
-- time, never the job time.
-- percentile (exact, deterministic) is used, not percentile_approx.
-- Idempotent: CREATE OR REPLACE gives the same content on a second run with the same silver.
-- Run: python dbsql.py --file databricks/sql/30_gold_market_summary.sql, or paste the
-- statement into the SQL editor after the silver notebook ran.
-- Manual check for one model (the gold row must show the same two values):
-- SELECT percentile(price_per_hour, 0.5) AS median_manual, percentile(price_per_hour, 0.9) AS p90_manual, count(*) AS n
-- FROM solgpu.silver.offers
-- WHERE gpu_name = 'RTX 4090' AND num_gpus = 1
--   AND captured_at = (SELECT max(captured_at) FROM solgpu.silver.offers);

CREATE OR REPLACE TABLE solgpu.gold.gpu_market_summary
USING DELTA
COMMENT 'Price benchmarks for each canonical GPU model over the single-GPU offers of the latest silver snapshot'
AS
WITH latest AS (
  SELECT *
  FROM solgpu.silver.offers
  WHERE captured_at = (SELECT max(captured_at) FROM solgpu.silver.offers)
    AND num_gpus = 1
)
SELECT
  gpu_name,
  count(*) AS listing_count,
  min(price_per_hour) AS lowest_price,
  percentile(price_per_hour, 0.5) AS median_price,
  percentile(price_per_hour, 0.9) AS p90_price,
  percentile(reliability, 0.5) AS median_reliability,
  max(captured_at) AS updated_at,
  max(snapshot_id) AS snapshot_id
FROM latest
GROUP BY gpu_name;
