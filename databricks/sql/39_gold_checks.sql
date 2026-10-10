-- Gold contract checks (#121). Runs as the last task of the solgpu-pipeline job, after the
-- three gold tables. Each rule becomes one row in solgpu.gold.contract_checks with the table
-- name, the rule, the number of failing rows, and passed. The last statement raises an error
-- with every failed rule of this run, so the task and the job fail and the app does not read
-- bad data. The checks do not roll back the gold tables. The rules cover the frozen contract
-- in prd.md section 8: the contract columns exist, no median is null, the percentiles are in
-- order, every table has rows, and the summary matches the latest silver capture.
-- Run: python dbsql.py --file databricks/sql/39_gold_checks.sql
-- Check: the last statement returns 0 rows when every rule passed, and FAILED with
-- "gold contract check failed: <table> [<rule>] failing_rows=<n>" when a rule failed.

CREATE TABLE IF NOT EXISTS solgpu.gold.contract_checks (
  checked_at TIMESTAMP,
  table_name STRING,
  rule STRING,
  failing_rows BIGINT,
  passed BOOLEAN
) USING DELTA
COMMENT 'One row per gold contract rule per pipeline run. passed = false fails the gold_checks task';

INSERT INTO solgpu.gold.contract_checks
SELECT current_timestamp(), table_name, rule, failing_rows, failing_rows = 0
FROM (
  SELECT 'gpu_market_summary' AS table_name, 'contract columns present' AS rule, count(*) AS failing_rows
  FROM VALUES ('gpu_name'), ('listing_count'), ('lowest_price'), ('median_price'), ('p90_price'), ('median_reliability'), ('updated_at') AS c(col)
  WHERE col NOT IN (SELECT column_name FROM solgpu.information_schema.columns
                    WHERE table_catalog = 'solgpu' AND table_schema = 'gold' AND table_name = 'gpu_market_summary')
  UNION ALL
  SELECT 'gpu_price_trends', 'contract columns present', count(*)
  FROM VALUES ('timestamp'), ('gpu_name'), ('region'), ('minimum_price'), ('p10_price'), ('median_price'), ('p90_price'), ('listing_count') AS c(col)
  WHERE col NOT IN (SELECT column_name FROM solgpu.information_schema.columns
                    WHERE table_catalog = 'solgpu' AND table_schema = 'gold' AND table_name = 'gpu_price_trends')
  UNION ALL
  SELECT 'offer_market_position', 'contract columns present', count(*)
  FROM VALUES ('offer_id'), ('snapshot_id'), ('market_position_pct'), ('price_percentile'), ('value_score') AS c(col)
  WHERE col NOT IN (SELECT column_name FROM solgpu.information_schema.columns
                    WHERE table_catalog = 'solgpu' AND table_schema = 'gold' AND table_name = 'offer_market_position')
  UNION ALL
  SELECT 'gpu_market_summary', 'no null median_price', count(*)
  FROM solgpu.gold.gpu_market_summary WHERE median_price IS NULL
  UNION ALL
  SELECT 'gpu_price_trends', 'no null median_price', count(*)
  FROM solgpu.gold.gpu_price_trends WHERE median_price IS NULL
  UNION ALL
  SELECT 'gpu_market_summary', 'lowest_price <= median_price <= p90_price', count(*)
  FROM solgpu.gold.gpu_market_summary
  WHERE NOT (lowest_price <= median_price AND median_price <= p90_price)
  UNION ALL
  SELECT 'gpu_price_trends', 'minimum_price <= p10_price <= median_price <= p90_price', count(*)
  FROM solgpu.gold.gpu_price_trends
  WHERE NOT (minimum_price <= p10_price AND p10_price <= median_price AND median_price <= p90_price)
  UNION ALL
  SELECT 'gpu_market_summary', 'at least one row', CASE WHEN count(*) = 0 THEN 1 ELSE 0 END
  FROM solgpu.gold.gpu_market_summary
  UNION ALL
  SELECT 'gpu_price_trends', 'at least one row', CASE WHEN count(*) = 0 THEN 1 ELSE 0 END
  FROM solgpu.gold.gpu_price_trends
  UNION ALL
  SELECT 'offer_market_position', 'at least one row', CASE WHEN count(*) = 0 THEN 1 ELSE 0 END
  FROM solgpu.gold.offer_market_position
  UNION ALL
  SELECT 'gpu_market_summary', 'updated_at matches silver latest capture',
    CASE WHEN max(updated_at) <> (SELECT max(captured_at) FROM solgpu.silver.offers) THEN 1 ELSE 0 END
  FROM solgpu.gold.gpu_market_summary
  UNION ALL
  SELECT 'offer_market_position', 'price_percentile within 0 to 100', count(*)
  FROM solgpu.gold.offer_market_position
  WHERE price_percentile < 0 OR price_percentile > 100
  UNION ALL
  SELECT 'offer_market_position', 'median matches gpu_market_summary', count(*)
  FROM (SELECT DISTINCT gpu_name, model_median_price FROM solgpu.gold.offer_market_position) o
  JOIN solgpu.gold.gpu_market_summary s USING (gpu_name)
  WHERE abs(o.model_median_price - s.median_price) > 1e-9
);

-- Fails the task only when a rule of this run failed. The literal separator holds no
-- semicolon because the runner splits the file on it.
SELECT raise_error(concat('gold contract check failed: ', failures))
FROM (
  SELECT concat_ws(' | ', collect_list(concat(table_name, ' [', rule, '] failing_rows=', failing_rows))) AS failures,
         count(*) AS n
  FROM solgpu.gold.contract_checks
  WHERE checked_at = (SELECT max(checked_at) FROM solgpu.gold.contract_checks) AND NOT passed
)
WHERE n > 0;
