# Databricks notebook source
# Bronze ingest: append the offers of every new snapshot file in the raw_snapshots volume to
# solgpu.bronze.vast_offers_raw. COPY INTO records each loaded file, so a second run on the same
# files appends no rows. Each row keeps the captured_at of its snapshot file, not the ingest time.
import json

dbutils.widgets.text("volume_path", "/Volumes/solgpu/bronze/raw_snapshots")
dbutils.widgets.text("table", "solgpu.bronze.vast_offers_raw")
volume_path = dbutils.widgets.get("volume_path")
table = dbutils.widgets.get("table")

# COMMAND ----------

rows_before = spark.table(table).count()
files_before = spark.sql(f"SELECT count(DISTINCT source_file) AS n FROM {table}").first()["n"]

# multiLine: one file is one JSON object with an offers array, not one object per line.
# inline(transform(...)) explodes the array in the select list, because the COPY INTO source
# query rejects LATERAL VIEW.
result = spark.sql(f"""
COPY INTO {table}
FROM (
  SELECT
    snapshot_id,
    to_timestamp(captured_at) AS captured_at,
    inline(transform(offers, o -> struct(CAST(o.id AS STRING) AS offer_id, to_json(o) AS raw))),
    _metadata.file_path AS source_file,
    current_timestamp() AS ingested_at
  FROM '{volume_path}'
)
FILEFORMAT = JSON
PATTERN = 'snapshot_*.json'
FORMAT_OPTIONS ('multiLine' = 'true')
COPY_OPTIONS ('mergeSchema' = 'false')
""").first()

# COMMAND ----------

rows_after = spark.table(table).count()
stats = spark.sql(f"""
SELECT count(DISTINCT source_file) AS files, count(DISTINCT snapshot_id) AS snapshots,
       min(captured_at) AS min_captured_at, max(captured_at) AS max_captured_at,
       min(ingested_at) AS min_ingested_at,
       sum(CASE WHEN captured_at >= ingested_at THEN 1 ELSE 0 END) AS captured_after_ingest
FROM {table}
""").first()

rows_appended = rows_after - rows_before
assert rows_appended == result["num_inserted_rows"], (rows_appended, result["num_inserted_rows"])
assert stats["captured_after_ingest"] == 0, "captured_at must come from the snapshot file, not the ingest time"

summary = {
    "files_loaded": stats["files"] - files_before,
    "rows_appended": rows_appended,
    "total_rows": rows_after,
    "snapshots": stats["snapshots"],
}
print(summary)
print(f"captured_at from {stats['min_captured_at']} to {stats['max_captured_at']}, first ingested_at {stats['min_ingested_at']}")
dbutils.notebook.exit(json.dumps(summary))
