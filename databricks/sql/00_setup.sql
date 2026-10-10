-- Create the Unity Catalog objects for the solGPU pipeline: the catalog, the bronze,
-- silver, and gold schemas, and the volume that holds the raw snapshot files.
-- Run: python dbsql.py --file databricks/sql/00_setup.sql, or paste the statements
-- into the SQL editor. Every statement uses IF NOT EXISTS, so a second run is safe.
-- Tables come in later files. This file creates no table and no grant.

CREATE CATALOG IF NOT EXISTS solgpu;

COMMENT ON CATALOG solgpu IS 'solGPU GPU market analytics: bronze raw snapshots, silver clean offers, gold insights';

CREATE SCHEMA IF NOT EXISTS solgpu.bronze;

CREATE SCHEMA IF NOT EXISTS solgpu.silver;

CREATE SCHEMA IF NOT EXISTS solgpu.gold;

CREATE VOLUME IF NOT EXISTS solgpu.bronze.raw_snapshots
COMMENT 'Raw Vast.ai snapshot files, one JSON file for each capture';
