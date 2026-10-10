CREATE TABLE IF NOT EXISTS reservations (
    id                 TEXT PRIMARY KEY,
    request_id         TEXT NOT NULL,
    snapshot_id        TEXT NOT NULL,
    offer_id           TEXT NOT NULL,
    wallet             TEXT NOT NULL,
    gpu_name           TEXT NOT NULL,
    price_per_hour     REAL NOT NULL,
    min_vram_gb        REAL NOT NULL,
    max_price_per_hour REAL NOT NULL,
    priority           TEXT NOT NULL,
    region             TEXT,
    created_at         TEXT NOT NULL,
    canonical_payload  TEXT NOT NULL,
    payload_hash       TEXT NOT NULL,
    status             TEXT NOT NULL,
    signature          TEXT,
    slot               INTEGER
);
CREATE INDEX IF NOT EXISTS reservations_wallet ON reservations (wallet, created_at DESC, id);
