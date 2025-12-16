-- Ledger Database Initial Schema

-- Snapshots table: stores monthly portfolio snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,  -- ISO 8601 format (YYYY-MM-DD)
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);

-- Holdings table: stores crypto holdings for each snapshot
CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL,
    asset_symbol TEXT NOT NULL,  -- BTC, ETH, etc.
    asset_name TEXT NOT NULL,     -- Bitcoin, Ethereum, etc.
    amount REAL NOT NULL,
    acquisition_date TEXT,        -- Optional: when acquired
    acquisition_price_eur REAL,   -- Optional: purchase price in EUR
    notes TEXT,
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
    CONSTRAINT positive_amount CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_holdings_snapshot ON holdings(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(asset_symbol);

-- Assets table: stores metadata about tracked crypto assets
CREATE TABLE IF NOT EXISTS assets (
    symbol TEXT PRIMARY KEY,      -- BTC, ETH, etc.
    name TEXT NOT NULL,            -- Bitcoin, Ethereum
    cmc_id INTEGER,                -- CoinMarketCap ID
    last_updated TEXT,
    is_active INTEGER DEFAULT 1
);
