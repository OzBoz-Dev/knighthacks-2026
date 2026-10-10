-- Build solgpu.gold.offer_market_position: one row for each single-GPU offer in the latest
-- silver snapshot. The API joins this table to show the price badge (prd.md 5.1) and the
-- fields market_position_pct and price_percentile of Offer in prd.md section 8. Match
-- explanations and the judges read this table.
-- Team rule for every gold price benchmark: single-GPU offers only, num_gpus = 1, the same
-- rule as gold.gpu_market_summary. A multi-GPU offer gets no row, so the API shows no badge
-- for it ("where available" in prd.md 5.1).
-- Comparison group = same canonical gpu_name in the same snapshot. Three outputs:
--   market_position_pct: signed percent above (+) or below (-) the group median price.
--   price_percentile: percent_rank of price_per_hour in the group, 0 to 100 (0 = cheapest).
--   value_score: README section "Offer value score". Min-max 0 to 100 inside the group,
--     weights 0.40 price, 0.35 dlperf, 0.25 reliability, one decimal. A flat component is 100.
-- Null rules: position and percentile are NULL when the model has one single-GPU listing.
-- value_score is NULL when dlperf is NULL or when fewer than 2 offers of the group have a
-- dlperf; offers with a null dlperf take no part in the score min, max, or count, so the
-- score windows partition on (gpu_name, dlperf IS NOT NULL).
-- Idempotent: CREATE OR REPLACE gives the same content on a second run with the same silver.
-- Run: python dbsql.py --file databricks/sql/32_gold_offer_market_position.sql
-- Check: the gold row of the median RTX 4090 offer must show market_position_pct near 0 and
-- model_median_price equal to median_price in gold.gpu_market_summary.

CREATE OR REPLACE TABLE solgpu.gold.offer_market_position
USING DELTA
COMMENT 'Market position, price percentile, and value score for each single-GPU offer of the latest silver snapshot, grouped by canonical GPU model'
AS
WITH latest AS (
  SELECT *
  FROM solgpu.silver.offers
  WHERE captured_at = (SELECT max(captured_at) FROM solgpu.silver.offers)
    AND num_gpus = 1
),
grp AS (
  SELECT *,
    count(*) OVER wm AS n_model,
    percentile(price_per_hour, 0.5) OVER wm AS median_price,
    percent_rank() OVER (PARTITION BY gpu_name ORDER BY price_per_hour) AS pct_rank,
    count(dlperf) OVER ws AS n_score,
    min(price_per_hour) OVER ws AS min_p, max(price_per_hour) OVER ws AS max_p,
    min(dlperf) OVER ws AS min_d, max(dlperf) OVER ws AS max_d,
    min(reliability) OVER ws AS min_r, max(reliability) OVER ws AS max_r
  FROM latest
  WINDOW wm AS (PARTITION BY gpu_name), ws AS (PARTITION BY gpu_name, dlperf IS NOT NULL)
)
SELECT
  id AS offer_id,
  snapshot_id,
  captured_at,
  gpu_name,
  price_per_hour,
  CASE WHEN n_model >= 2 THEN round((price_per_hour - median_price) / median_price * 100, 1) END AS market_position_pct,
  CASE WHEN n_model >= 2 THEN round(pct_rank * 100, 1) END AS price_percentile,
  CASE WHEN dlperf IS NULL OR n_score < 2 THEN NULL ELSE round(
      0.40 * CASE WHEN max_p = min_p THEN 100 ELSE 100 * (max_p - price_per_hour) / (max_p - min_p) END
    + 0.35 * CASE WHEN max_d = min_d THEN 100 ELSE 100 * (dlperf - min_d) / (max_d - min_d) END
    + 0.25 * CASE WHEN max_r = min_r THEN 100 ELSE 100 * (reliability - min_r) / (max_r - min_r) END, 1) END AS value_score,
  median_price AS model_median_price,
  n_model AS model_listing_count
FROM grp;
