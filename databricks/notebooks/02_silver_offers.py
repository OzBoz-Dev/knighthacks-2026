# Databricks notebook source
# Silver offers: cast every bronze row to the typed Offer columns of prd.md section 8 (plus
# snapshot_id and captured_at). Units follow databricks/README.md "Vast.ai field units".
# Rows that fail a reject rule, and duplicate (snapshot_id, id) rows, go to offers_rejected with a reason.
# gpu_name and region come from the explicit maps in sql/20_name_maps.sql; a value with no map
# row keeps its raw value and gets gpu_name_mapped or region_mapped = false.
import json

dbutils.widgets.text("source_table", "solgpu.bronze.vast_offers_raw")
dbutils.widgets.text("target_table", "solgpu.silver.offers")
dbutils.widgets.text("rejected_table", "solgpu.silver.offers_rejected")
dbutils.widgets.text("include_test_rows", "false")
source_table = dbutils.widgets.get("source_table")
target_table = dbutils.widgets.get("target_table")
rejected_table = dbutils.widgets.get("rejected_table")
include_test_rows = dbutils.widgets.get("include_test_rows") == "true"

# COMMAND ----------

# shortcut: synthetic test rows live behind a widget, upgrade to a real test fixture file in the volume when the pipeline has a test stage
test_rows_sql = """
  UNION ALL SELECT * FROM VALUES
    ('test_rules', TIMESTAMP '2026-01-01 00:00:00', 'test_missing_gpu', NULL, NULL, 1, 24, 'US', 'Oregon, US', 1.0, 0.9, 100.0, true, TIMESTAMP '2026-01-01 00:00:00', 'test'),
    ('test_rules', TIMESTAMP '2026-01-01 00:00:00', 'test_nonpositive_price', 'RTX 4090', 'RTX 4090', 1, 24, 'US', 'Oregon, US', 0.0, 0.9, 100.0, true, TIMESTAMP '2026-01-01 00:00:00', 'test'),
    ('test_rules', TIMESTAMP '2026-01-01 00:00:00', 'test_bad_reliability', 'RTX 4090', 'RTX 4090', 1, 24, 'US', 'Oregon, US', 1.0, 1.5, 100.0, true, TIMESTAMP '2026-01-01 00:00:00', 'test'),
    ('test_rules', TIMESTAMP '2026-01-01 00:00:00', 'test_duplicate', 'RTX 4090', 'RTX 4090', 1, 24, 'US', 'Oregon, US', 1.0, 0.9, 100.0, true, TIMESTAMP '2026-01-01 00:00:00', 'test'),
    ('test_rules', TIMESTAMP '2026-01-01 00:00:00', 'test_duplicate', 'RTX 4090', 'RTX 4090', 1, 24, 'US', 'Oregon, US', 1.0, 0.9, 100.0, true, TIMESTAMP '2026-01-01 00:00:01', 'test')
""" if include_test_rows else ""

# shortcut: full rebuild from bronze each run, upgrade to an incremental MERGE when bronze passes about 1 million rows
spark.sql(f"""
CREATE OR REPLACE TEMP VIEW silver_candidates AS
WITH typed AS (
  SELECT
    snapshot_id,
    captured_at,
    offer_id AS id,
    CAST(raw:gpu_name AS STRING) AS gpu_name,
    CAST(raw:gpu_name AS STRING) AS gpu_name_raw,
    CAST(raw:num_gpus AS INT) AS num_gpus,
    CAST(round(CAST(raw:gpu_ram AS DOUBLE) / 1024, 0) AS INT) AS gpu_ram_gb,
    coalesce(nullif(regexp_extract(CAST(raw:geolocation AS STRING), ', ([A-Z]{{2}})$', 1), ''), 'unknown') AS region,
    CAST(raw:geolocation AS STRING) AS region_raw,
    CAST(raw:dph_total AS DOUBLE) AS price_per_hour,
    CAST(raw:reliability2 AS DOUBLE) AS reliability,
    CAST(raw:dlperf AS DOUBLE) AS dlperf,
    (CAST(raw:verification AS STRING) = 'verified') AS verified,
    ingested_at,
    source_file
  FROM {source_table}
  {test_rows_sql}
),
mapped AS (
  SELECT
    t.* EXCEPT (gpu_name, region),
    coalesce(g.canonical_name, t.gpu_name_raw) AS gpu_name,
    g.raw_name IS NOT NULL AS gpu_name_mapped,
    coalesce(r.canonical_region, t.region) AS region,
    r.raw_region IS NOT NULL AS region_mapped
  FROM typed t
  LEFT JOIN solgpu.silver.gpu_name_map g ON t.gpu_name_raw = g.raw_name
  LEFT JOIN solgpu.silver.region_map r ON t.region = r.raw_region
),
ranked AS (
  SELECT *, row_number() OVER (PARTITION BY snapshot_id, id ORDER BY ingested_at, source_file) AS rn FROM mapped
)
SELECT
  snapshot_id, captured_at, id, gpu_name, gpu_name_raw, gpu_name_mapped, num_gpus, gpu_ram_gb,
  gpu_ram_gb * num_gpus AS total_vram_gb,
  region, region_raw, region_mapped, price_per_hour, reliability, dlperf,
  CASE WHEN price_per_hour > 0 THEN dlperf / price_per_hour END AS performance_per_dollar,
  verified,
  CASE
    WHEN gpu_name IS NULL OR trim(gpu_name) = '' THEN 'missing_gpu_name'
    WHEN price_per_hour IS NULL OR price_per_hour <= 0 THEN 'nonpositive_price'
    WHEN reliability IS NULL OR reliability < 0 OR reliability > 1 THEN 'reliability_out_of_range'
    WHEN rn > 1 THEN 'duplicate'
  END AS reject_reason
FROM ranked
""")
spark.sql(f"CREATE OR REPLACE TABLE {target_table} USING DELTA AS SELECT * EXCEPT (reject_reason) FROM silver_candidates WHERE reject_reason IS NULL")
spark.sql(f"CREATE OR REPLACE TABLE {rejected_table} USING DELTA AS SELECT *, current_timestamp() AS rejected_at FROM silver_candidates WHERE reject_reason IS NOT NULL")

# COMMAND ----------

bronze_rows = spark.table(source_table).count() + (5 if include_test_rows else 0)
silver_rows = spark.table(target_table).count()
rejected_df = spark.sql(f"SELECT reject_reason, count(*) AS n FROM {rejected_table} GROUP BY reject_reason ORDER BY reject_reason")
rejected_df.show(truncate=False)
rejected_by_reason = {r["reject_reason"]: r["n"] for r in rejected_df.collect()}
duplicate_pairs = spark.sql(f"SELECT count(*) AS n FROM (SELECT snapshot_id, id FROM {target_table} GROUP BY 1, 2 HAVING count(*) > 1)").first()["n"]
test_rows_in_silver = spark.sql(f"SELECT count(*) AS n FROM {target_table} WHERE snapshot_id = 'test_rules'").first()["n"]
unmapped_df = spark.sql(f"""
SELECT 'gpu' AS kind, gpu_name_raw AS raw_value, count(*) AS n FROM {target_table}
WHERE NOT gpu_name_mapped AND snapshot_id = (SELECT max(snapshot_id) FROM {target_table}) GROUP BY 1, 2
UNION ALL
SELECT 'region' AS kind, region_raw AS raw_value, count(*) AS n FROM {target_table}
WHERE NOT region_mapped AND snapshot_id = (SELECT max(snapshot_id) FROM {target_table}) GROUP BY 1, 2
ORDER BY 1, 3 DESC
""")
unmapped_df.show(truncate=False)
unmapped = unmapped_df.collect()

summary = {
    "bronze_rows": bronze_rows,
    "silver_rows": silver_rows,
    "rejected_rows": sum(rejected_by_reason.values()),
    "rejected_by_reason": rejected_by_reason,
    "duplicates": rejected_by_reason.get("duplicate", 0),
    "duplicate_pairs_in_silver": duplicate_pairs,
    "unmapped_gpu_names": sum(1 for r in unmapped if r["kind"] == "gpu"),
    "unmapped_regions": sum(1 for r in unmapped if r["kind"] == "region"),
}
print(summary)
assert summary["bronze_rows"] == summary["silver_rows"] + summary["rejected_rows"], "every row is kept or rejected"
assert duplicate_pairs == 0, "silver.offers holds no duplicate (snapshot_id, id)"
assert include_test_rows or test_rows_in_silver == 0, "production silver holds no test rows"
dbutils.notebook.exit(json.dumps(summary))
