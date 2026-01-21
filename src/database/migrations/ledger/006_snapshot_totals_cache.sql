-- Snapshot totals cache for fast list queries
-- Invalidated when holdings or liability balances change

CREATE TABLE IF NOT EXISTS snapshot_totals_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL UNIQUE,
    total_assets_eur REAL NOT NULL DEFAULT 0,
    total_liabilities_eur REAL NOT NULL DEFAULT 0,
    net_worth_eur REAL NOT NULL DEFAULT 0,
    cached_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshot_totals_snapshot_id ON snapshot_totals_cache(snapshot_id);
