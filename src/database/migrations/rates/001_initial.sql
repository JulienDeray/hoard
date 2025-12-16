-- Rates Database Initial Schema

-- Historical rates table: stores historical price data
CREATE TABLE IF NOT EXISTS historical_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_symbol TEXT NOT NULL,
    base_currency TEXT NOT NULL DEFAULT 'EUR',
    price REAL NOT NULL,
    timestamp TEXT NOT NULL,      -- ISO 8601 format
    volume_24h REAL,
    market_cap REAL,
    source TEXT DEFAULT 'coinmarketcap',
    UNIQUE(asset_symbol, base_currency, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_rates_symbol_timestamp ON historical_rates(asset_symbol, timestamp);
CREATE INDEX IF NOT EXISTS idx_rates_symbol_currency ON historical_rates(asset_symbol, base_currency);

-- Rate cache table: caches current prices (5-minute TTL)
CREATE TABLE IF NOT EXISTS rate_cache (
    asset_symbol TEXT NOT NULL,
    base_currency TEXT NOT NULL DEFAULT 'EUR',
    price REAL NOT NULL,
    last_updated TEXT NOT NULL,
    UNIQUE(asset_symbol, base_currency)
);

CREATE INDEX IF NOT EXISTS idx_cache_symbol ON rate_cache(asset_symbol);
