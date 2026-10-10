-- Gold query for the price trends endpoint (GET /api/market/trends, prd.md section 8).
-- Returns the TrendPoint contract columns, in contract order and nothing else, one row for
-- each snapshot of one canonical GPU model in one region, ordered by timestamp ascending.
-- timestamp is a reserved word, so it stays in backticks, the same as the Go client.
--
-- Parameters (named parameters only, never put a request value into the SQL text):
--   :gpu_name  STRING  canonical model name, for example 'RTX 4090', 'A100 SXM', 'H100 SXM'
--   :region    STRING  country code, for example 'US', or 'all' (lower case) for every region
--
-- Run in the SQL editor: paste the statement, the editor prompts for both values.
-- Run from the helper: python dbsql.py --file databricks/queries/price_trends.sql --param gpu_name="RTX 4090" --param region=all
-- The Go client (api/databricks/market.go) binds the values through the Statement Execution API:
--   "parameters": [{"name": "gpu_name", "value": "RTX 4090"}, {"name": "region", "value": "all"}]
SELECT `timestamp`, minimum_price, median_price, p10_price, p90_price, listing_count
FROM solgpu.gold.gpu_price_trends
WHERE gpu_name = :gpu_name AND region = :region
ORDER BY `timestamp` ASC
