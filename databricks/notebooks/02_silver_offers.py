# Databricks notebook source
# Silver offers: cast every bronze row to the typed Offer columns of prd.md section 8 (plus
# snapshot_id and captured_at). Units follow databricks/README.md "Vast.ai field units".
# This notebook does not dedupe and does not reject rows, #86 adds that.
import json

dbutils.widgets.text("source_table", "solgpu.bronze.vast_offers_raw")
dbutils.widgets.text("target_table", "solgpu.silver.offers")
source_table = dbutils.widgets.get("source_table")
target_table = dbutils.widgets.get("target_table")

# COMMAND ----------

# shortcut: full rebuild from bronze each run, upgrade to an incremental MERGE when bronze passes about 1 million rows
spark.sql(f"""
CREATE OR REPLACE TABLE {target_table} USING DELTA AS
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
    (CAST(raw:verification AS STRING) = 'verified') AS verified
  FROM {source_table}
)
SELECT
  snapshot_id, captured_at, id, gpu_name, gpu_name_raw, num_gpus, gpu_ram_gb,
  gpu_ram_gb * num_gpus AS total_vram_gb,
  region, region_raw, price_per_hour, reliability, dlperf,
  CASE WHEN price_per_hour > 0 THEN dlperf / price_per_hour END AS performance_per_dollar,
  verified
FROM typed
""")

# COMMAND ----------

bronze_rows = spark.table(source_table).count()
stats = spark.sql(f"""
SELECT count(*) AS silver_rows, count(DISTINCT snapshot_id) AS snapshots, count(DISTINCT gpu_name) AS gpu_names,
       sum(CASE WHEN reliability < 0 OR reliability > 1 THEN 1 ELSE 0 END) AS bad_reliability,
       sum(CASE WHEN total_vram_gb <> gpu_ram_gb * num_gpus THEN 1 ELSE 0 END) AS bad_total_vram
FROM {target_table}
""").first()

summary = {
    "bronze_rows": bronze_rows,
    "silver_rows": stats["silver_rows"],
    "snapshots": stats["snapshots"],
    "gpu_names": stats["gpu_names"],
    "bad_reliability": stats["bad_reliability"],
    "bad_total_vram": stats["bad_total_vram"],
}
print(summary)
assert summary["bronze_rows"] == summary["silver_rows"], "this issue keeps every bronze row"
assert summary["bad_reliability"] == 0 and summary["bad_total_vram"] == 0, summary

# Three offers to compare with the Vast.ai web page: RTX 4090 and RTX 3090 show 24 GB, H100 SXM 80 GB.
spark.sql(f"""
SELECT id, gpu_name, gpu_ram_gb, total_vram_gb, price_per_hour, region FROM {target_table}
WHERE gpu_name_raw IN ('RTX 4090', 'RTX 3090', 'H100 SXM') AND num_gpus = 1
QUALIFY row_number() OVER (PARTITION BY gpu_name_raw ORDER BY price_per_hour, id) = 1
ORDER BY gpu_name
""").show(truncate=False)
dbutils.notebook.exit(json.dumps(summary))
