# Databricks notebook source
# Data quality: one row for each bronze snapshot with the raw row count, the rows rejected by each
# reason, the duplicates removed, and the GPU names before the name map (distinct_gpu_names_raw),
# after the name map (distinct_gpu_names_canonical), and still unmapped (unmapped_gpu_names).
# The dashboard and the judges read this table.
import json

dbutils.widgets.text("bronze_table", "solgpu.bronze.vast_offers_raw")
dbutils.widgets.text("silver_table", "solgpu.silver.offers")
dbutils.widgets.text("rejected_table", "solgpu.silver.offers_rejected")
dbutils.widgets.text("target_table", "solgpu.silver.data_quality")
bronze_table = dbutils.widgets.get("bronze_table")
silver_table = dbutils.widgets.get("silver_table")
rejected_table = dbutils.widgets.get("rejected_table")
target_table = dbutils.widgets.get("target_table")

# COMMAND ----------

# Bronze is the base and the joins are LEFT, so the synthetic test_rules snapshot of the silver
# notebook (present only in silver and rejected) never reaches this table.
spark.sql(f"""
CREATE OR REPLACE TABLE {target_table} USING DELTA AS
WITH b AS (
  SELECT snapshot_id, min(captured_at) AS captured_at, count(*) AS raw_rows,
    count(DISTINCT CAST(raw:gpu_name AS STRING)) AS distinct_gpu_names_raw
  FROM {bronze_table} GROUP BY snapshot_id
),
s AS (
  SELECT snapshot_id, count(*) AS silver_rows,
    count(DISTINCT gpu_name) AS distinct_gpu_names_canonical,
    count(DISTINCT CASE WHEN NOT gpu_name_mapped THEN gpu_name_raw END) AS unmapped_gpu_names,
    count_if(NOT gpu_name_mapped) AS unmapped_gpu_rows,
    count(DISTINCT CASE WHEN NOT region_mapped THEN region_raw END) AS unmapped_regions
  FROM {silver_table} GROUP BY snapshot_id
),
r AS (
  SELECT snapshot_id, count(*) AS rejected_total,
    count_if(reject_reason = 'missing_gpu_name') AS rejected_missing_gpu_name,
    count_if(reject_reason = 'nonpositive_price') AS rejected_nonpositive_price,
    count_if(reject_reason = 'reliability_out_of_range') AS rejected_reliability_out_of_range,
    count_if(reject_reason = 'duplicate') AS duplicates_removed
  FROM {rejected_table} GROUP BY snapshot_id
)
SELECT
  snapshot_id, captured_at, raw_rows,
  coalesce(silver_rows, 0) AS silver_rows,
  coalesce(rejected_total, 0) AS rejected_total,
  coalesce(rejected_missing_gpu_name, 0) AS rejected_missing_gpu_name,
  coalesce(rejected_nonpositive_price, 0) AS rejected_nonpositive_price,
  coalesce(rejected_reliability_out_of_range, 0) AS rejected_reliability_out_of_range,
  coalesce(duplicates_removed, 0) AS duplicates_removed,
  distinct_gpu_names_raw,
  coalesce(distinct_gpu_names_canonical, 0) AS distinct_gpu_names_canonical,
  coalesce(unmapped_gpu_names, 0) AS unmapped_gpu_names,
  coalesce(unmapped_gpu_rows, 0) AS unmapped_gpu_rows,
  coalesce(unmapped_regions, 0) AS unmapped_regions,
  current_timestamp() AS computed_at
FROM b LEFT JOIN s USING (snapshot_id) LEFT JOIN r USING (snapshot_id)
""")

# COMMAND ----------

rows = spark.sql(f"SELECT * FROM {target_table} ORDER BY captured_at DESC").collect()
bronze_snapshots = spark.sql(f"SELECT count(DISTINCT snapshot_id) AS n FROM {bronze_table}").first()["n"]
assert len(rows) == bronze_snapshots, "one row for each bronze snapshot"
for r in rows:
    # A mismatch means the silver notebook did not run after the last bronze ingest.
    assert r["raw_rows"] == r["silver_rows"] + r["rejected_total"], f"snapshot {r['snapshot_id']}: raw_rows != silver_rows + rejected_total"

latest = {k: str(v) if k in ("captured_at", "computed_at") else v for k, v in rows[0].asDict().items()}
latest["snapshot_rows"] = len(rows)
print(latest)
dbutils.notebook.exit(json.dumps(latest))
