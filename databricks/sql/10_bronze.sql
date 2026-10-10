-- Create the append-only bronze table solgpu.bronze.vast_offers_raw. One row holds one raw
-- Vast.ai offer exactly as collected, plus the snapshot ID, the capture time, the source
-- file, and the ingest time. The ingest notebook (COPY INTO from the raw_snapshots volume)
-- is the only writer, and it only appends. No step runs UPDATE, DELETE, or MERGE on this
-- table. The property delta.appendOnly makes Delta reject an UPDATE or a DELETE.
-- Run: python dbsql.py --file databricks/sql/10_bronze.sql, or paste the statement into
-- the SQL editor. The statement uses IF NOT EXISTS, so a second run is safe.

CREATE TABLE IF NOT EXISTS solgpu.bronze.vast_offers_raw (
  snapshot_id STRING COMMENT 'Snapshot ID from the snapshot file, for example 20261010T211605Z',
  captured_at TIMESTAMP COMMENT 'Capture time from the snapshot file, never the ingest time',
  offer_id STRING COMMENT 'Raw offer id cast to a string, matches Offer.id in prd.md section 8',
  raw STRING COMMENT 'The whole raw offer object as a JSON string, read fields with raw:gpu_name',
  source_file STRING COMMENT 'Path of the snapshot file in the raw_snapshots volume',
  ingested_at TIMESTAMP COMMENT 'Time the ingest notebook appended the row'
)
USING DELTA
COMMENT 'Append-only raw Vast.ai offers, one row for each offer in each snapshot'
TBLPROPERTIES ('delta.appendOnly' = 'true');
