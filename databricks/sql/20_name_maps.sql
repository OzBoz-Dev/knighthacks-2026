-- Create and fill the explicit name maps solgpu.silver.gpu_name_map and solgpu.silver.region_map.
-- The silver notebook (02_silver_offers.py) left joins both maps and keeps the raw value when
-- no map row exists, so the data-quality output can list every unmapped name. No step guesses
-- a name by a pattern.
-- To add an alias: add one VALUES row below, run this file, then run the silver notebook.
-- Run: python dbsql.py --file databricks/sql/20_name_maps.sql, or paste the statements into
-- the SQL editor. CREATE TABLE IF NOT EXISTS plus INSERT OVERWRITE makes a second run give
-- the same content.
-- Canonical GPU names follow the Vast.ai spelling, except where the Explore basket in
-- databricks/README.md "GPU price index method" spells the model another way
-- (A100 PCIe, H100 SXM, V100) and where Vast.ai shortens a name (SXM4, Ada, Q, S).
-- On purpose, three rare raw names (one bronze row each) have no map row, so the unmapped
-- query below has rows to show: Q RTX 5000, RTX 2060S, RTX A4500.

CREATE TABLE IF NOT EXISTS solgpu.silver.gpu_name_map (
  raw_name STRING COMMENT 'Exact raw gpu_name value from Vast.ai, or a known alias',
  canonical_name STRING COMMENT 'Canonical model name the Explore UI shows'
)
USING DELTA
COMMENT 'Explicit alias map from raw Vast.ai gpu_name to one canonical name, one row for each alias';

INSERT OVERWRITE solgpu.silver.gpu_name_map VALUES
  ('A10', 'A10'),
  ('A100 PCIE', 'A100 PCIe'),
  ('A100 SXM4', 'A100 SXM'),
  ('A100-SXM4-80GB', 'A100 SXM'),
  ('A40', 'A40'),
  ('B200', 'B200'),
  ('GTX 1060', 'GTX 1060'),
  ('GTX 1070', 'GTX 1070'),
  ('GTX 1080', 'GTX 1080'),
  ('GTX 1080 Ti', 'GTX 1080 Ti'),
  ('GTX 1650', 'GTX 1650'),
  ('GTX 1660', 'GTX 1660'),
  ('GTX TITAN X', 'GTX TITAN X'),
  ('GeForce RTX 3090', 'RTX 3090'),
  ('GeForce RTX 4090', 'RTX 4090'),
  ('H100 NVL', 'H100 NVL'),
  ('H100 PCIE', 'H100 PCIe'),
  ('H100 SXM', 'H100 SXM'),
  ('NVIDIA H100 80GB HBM3', 'H100 SXM'),
  ('H200', 'H200'),
  ('L4', 'L4'),
  ('L40', 'L40'),
  ('L40S', 'L40S'),
  ('Q RTX 6000', 'Quadro RTX 6000'),
  ('Q RTX 8000', 'Quadro RTX 8000'),
  ('Quadro P2000', 'Quadro P2000'),
  ('Quadro P4000', 'Quadro P4000'),
  ('RTX 2060', 'RTX 2060'),
  ('RTX 2070', 'RTX 2070'),
  ('RTX 2070S', 'RTX 2070 SUPER'),
  ('RTX 2080 Ti', 'RTX 2080 Ti'),
  ('RTX 3060', 'RTX 3060'),
  ('RTX 3060 Ti', 'RTX 3060 Ti'),
  ('RTX 3060 laptop', 'RTX 3060 laptop'),
  ('RTX 3070', 'RTX 3070'),
  ('RTX 3080', 'RTX 3080'),
  ('RTX 3080 Ti', 'RTX 3080 Ti'),
  ('RTX 3090', 'RTX 3090'),
  ('RTX_3090', 'RTX 3090'),
  ('RTX 3090 Ti', 'RTX 3090 Ti'),
  ('RTX 4060', 'RTX 4060'),
  ('RTX 4060 Ti', 'RTX 4060 Ti'),
  ('RTX 4070', 'RTX 4070'),
  ('RTX 4070S', 'RTX 4070 SUPER'),
  ('RTX 4080', 'RTX 4080'),
  ('RTX 4080S', 'RTX 4080 SUPER'),
  ('RTX 4090', 'RTX 4090'),
  ('RTX_4090', 'RTX 4090'),
  ('RTX 4090D', 'RTX 4090D'),
  ('RTX 5060', 'RTX 5060'),
  ('RTX 5060 Ti', 'RTX 5060 Ti'),
  ('RTX 5070', 'RTX 5070'),
  ('RTX 5080', 'RTX 5080'),
  ('RTX 5090', 'RTX 5090'),
  ('RTX 6000Ada', 'RTX 6000 Ada'),
  ('RTX A2000', 'RTX A2000'),
  ('RTX A4000', 'RTX A4000'),
  ('RTX A5000', 'RTX A5000'),
  ('RTX A6000', 'RTX A6000'),
  ('Tesla P100', 'Tesla P100'),
  ('Tesla P40', 'Tesla P40'),
  ('Tesla T4', 'Tesla T4'),
  ('Tesla V100', 'V100'),
  ('V100', 'V100'),
  ('Titan Xp', 'Titan Xp');

CREATE TABLE IF NOT EXISTS solgpu.silver.region_map (
  raw_region STRING COMMENT 'Two-letter code the silver notebook extracts from geolocation, or unknown',
  canonical_region STRING COMMENT 'Canonical upper-case ISO 3166-1 alpha-2 code the Explore UI shows'
)
USING DELTA
COMMENT 'Explicit allowlist of region codes, one row for each code seen in bronze plus unknown';

INSERT OVERWRITE solgpu.silver.region_map VALUES
  ('AE', 'AE'), ('AL', 'AL'), ('AR', 'AR'), ('AT', 'AT'), ('AU', 'AU'), ('BE', 'BE'), ('BG', 'BG'),
  ('BR', 'BR'), ('BT', 'BT'), ('BY', 'BY'), ('CA', 'CA'), ('CH', 'CH'), ('CL', 'CL'), ('CN', 'CN'),
  ('CO', 'CO'), ('CZ', 'CZ'), ('DE', 'DE'), ('DK', 'DK'), ('EE', 'EE'), ('ES', 'ES'), ('FI', 'FI'),
  ('FR', 'FR'), ('GB', 'GB'), ('GR', 'GR'), ('HK', 'HK'), ('HR', 'HR'), ('HU', 'HU'), ('ID', 'ID'),
  ('IE', 'IE'), ('IL', 'IL'), ('IN', 'IN'), ('IS', 'IS'), ('IT', 'IT'), ('JP', 'JP'), ('KR', 'KR'),
  ('KZ', 'KZ'), ('LT', 'LT'), ('LV', 'LV'), ('MX', 'MX'), ('MY', 'MY'), ('NL', 'NL'), ('NO', 'NO'),
  ('NP', 'NP'), ('NZ', 'NZ'), ('OM', 'OM'), ('PL', 'PL'), ('PT', 'PT'), ('QA', 'QA'), ('RO', 'RO'),
  ('RS', 'RS'), ('RU', 'RU'), ('SE', 'SE'), ('SG', 'SG'), ('SI', 'SI'), ('SK', 'SK'), ('TH', 'TH'),
  ('TR', 'TR'), ('TW', 'TW'), ('TZ', 'TZ'), ('UA', 'UA'), ('US', 'US'), ('VN', 'VN'), ('ZA', 'ZA'),
  ('unknown', 'unknown');

-- Unmapped names in the latest snapshot (paste into the SQL editor after the silver notebook ran):
-- SELECT 'gpu' AS kind, gpu_name_raw AS raw_value, count(*) AS n
-- FROM solgpu.silver.offers
-- WHERE NOT gpu_name_mapped AND snapshot_id = (SELECT max(snapshot_id) FROM solgpu.silver.offers)
-- GROUP BY 1, 2
-- UNION ALL
-- SELECT 'region' AS kind, region_raw AS raw_value, count(*) AS n
-- FROM solgpu.silver.offers
-- WHERE NOT region_mapped AND snapshot_id = (SELECT max(snapshot_id) FROM solgpu.silver.offers)
-- GROUP BY 1, 2
-- ORDER BY 1, 3 DESC;
