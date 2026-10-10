-- Build solgpu.gold.gpu_price_index: one row for each snapshot with the equal-weight mean of the
-- median single-GPU hourly price over a fixed basket of canonical GPU models. The browser reads
-- the index; it does not calculate it. The method is databricks/README.md section "GPU price
-- index method (for team review in #29)".
-- Basket: A100 PCIe, A40, H100 SXM, L40S, RTX 3090, RTX 4090, RTX A6000, V100. The basket is the
-- VALUES list below, never derived from the data. A pull request changes it.
-- Input: gold.gpu_price_trends rows with region = 'all'. That table holds num_gpus = 1 offers
-- only (#101), so its median_price is the model median the README defines.
-- Rules: a model counts as present only with at least 3 single-GPU offers (README proposal, one
-- number below). index_value is NULL when models_present < basket_size, so the chart shows a gap.
-- models_present_list is an extra column so the dashboard can show which model is missing.
-- Idempotent: CREATE OR REPLACE rebuilds the table from the trends table on every run.
-- Run: python dbsql.py --file databricks/sql/33_gold_gpu_price_index.sql, or paste into the SQL editor.

CREATE OR REPLACE TABLE solgpu.gold.gpu_price_index
USING DELTA
COMMENT 'GPU price index for each snapshot: equal-weight mean of median single-GPU hourly prices over a fixed basket, NULL when a basket model is missing'
AS
WITH basket AS (
  SELECT * FROM VALUES ('A100 PCIe'), ('A40'), ('H100 SXM'), ('L40S'),
                       ('RTX 3090'), ('RTX 4090'), ('RTX A6000'), ('V100') AS b(gpu_name)
),
snapshots AS (
  SELECT DISTINCT snapshot_id, timestamp AS captured_at FROM solgpu.gold.gpu_price_trends
),
present AS (
  SELECT t.snapshot_id, t.gpu_name, t.median_price
  FROM solgpu.gold.gpu_price_trends t
  JOIN basket USING (gpu_name)
  WHERE t.region = 'all' AND t.listing_count >= 3
)
SELECT
  s.snapshot_id,
  s.captured_at,
  CASE WHEN count(p.gpu_name) = (SELECT count(*) FROM basket) THEN avg(p.median_price) END AS index_value,
  (SELECT count(*) FROM basket) AS basket_size,
  count(p.gpu_name) AS models_present,
  concat_ws(', ', sort_array(collect_list(p.gpu_name))) AS models_present_list
FROM snapshots s
LEFT JOIN present p USING (snapshot_id)
GROUP BY s.snapshot_id, s.captured_at;
