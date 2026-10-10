-- Gold query for the market summary endpoint (GET /api/market/summary, prd.md section 8).
-- Returns the MarketSummary contract columns, in contract order, for one canonical GPU model.
-- The table holds one row for each model in the latest snapshot, so the result is one row
-- or zero rows (unknown model).
--
-- Parameters (named parameters only, never put a request value into the SQL text):
--   :gpu_name  STRING  canonical model name, for example 'RTX 4090', 'A100 SXM', 'H100 SXM'
--
-- Run in the SQL editor: paste the statement, the editor prompts for the gpu_name value.
-- Run from the helper: python dbsql.py --file databricks/queries/market_summary.sql --param gpu_name="RTX 4090"
-- The Go client (api/databricks/market.go) binds the value through the Statement Execution API:
--   "parameters": [{"name": "gpu_name", "value": "RTX 4090"}]
SELECT gpu_name, listing_count, lowest_price, median_price, p90_price, median_reliability, updated_at
FROM solgpu.gold.gpu_market_summary
WHERE gpu_name = :gpu_name
