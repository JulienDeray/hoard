-- Test database schema (v7 final state)
-- This is a clean schema for testing purposes, not for migrations

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_version (version, description) VALUES (7, 'Add metadata column to assets for property details');

-- Snapshots table (totals are calculated dynamically from holdings + rates)
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);

-- Assets table (v7 schema with metadata column)
CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    asset_class TEXT NOT NULL DEFAULT 'CRYPTO',
    valuation_source TEXT NOT NULL DEFAULT 'CMC',
    external_id TEXT,
    currency TEXT NOT NULL DEFAULT 'EUR',
    is_active INTEGER DEFAULT 1,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_asset_class CHECK (asset_class IN ('CRYPTO', 'FIAT', 'STOCK', 'REAL_ESTATE', 'COMMODITY', 'OTHER')),
    CONSTRAINT valid_valuation_source CHECK (valuation_source IN ('CMC', 'MANUAL', 'YAHOO', 'CUSTOM_API'))
);

CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);
CREATE INDEX IF NOT EXISTS idx_assets_class ON assets(asset_class);
CREATE INDEX IF NOT EXISTS idx_assets_real_estate ON assets(asset_class) WHERE asset_class = 'REAL_ESTATE';

-- Holdings table (v4 schema with asset_id FK, no value_eur)
CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL,
    asset_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    CONSTRAINT positive_amount CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_holdings_snapshot ON holdings(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_holdings_asset ON holdings(asset_id);

-- Allocation targets table (v3 schema)
CREATE TABLE IF NOT EXISTS allocation_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL DEFAULT 'ASSET',
    target_key TEXT NOT NULL,
    target_percentage REAL NOT NULL,
    tolerance_pct REAL DEFAULT 2.0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    CONSTRAINT valid_target_type CHECK (target_type IN ('ASSET', 'ASSET_CLASS')),
    CONSTRAINT valid_percentage CHECK (target_percentage >= 0 AND target_percentage <= 100),
    CONSTRAINT valid_tolerance CHECK (tolerance_pct >= 0 AND tolerance_pct <= 100),
    UNIQUE(target_type, target_key)
);

CREATE INDEX IF NOT EXISTS idx_allocation_targets_key ON allocation_targets(target_type, target_key);

-- Liabilities table
CREATE TABLE IF NOT EXISTS liabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    liability_type TEXT NOT NULL,
    linked_asset_id INTEGER,
    original_amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    interest_rate REAL,
    start_date TEXT,
    term_months INTEGER,
    is_active INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_asset_id) REFERENCES assets(id),
    CONSTRAINT valid_liability_type CHECK (liability_type IN ('LOAN', 'MORTGAGE', 'CREDIT_LINE')),
    CONSTRAINT positive_original_amount CHECK (original_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_liabilities_active ON liabilities(is_active);
CREATE INDEX IF NOT EXISTS idx_liabilities_linked_asset ON liabilities(linked_asset_id);

-- Liability balances table (v4 schema, no value_eur)
CREATE TABLE IF NOT EXISTS liability_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL,
    liability_id INTEGER NOT NULL,
    outstanding_amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
    FOREIGN KEY (liability_id) REFERENCES liabilities(id) ON DELETE CASCADE,
    CONSTRAINT positive_outstanding CHECK (outstanding_amount >= 0),
    UNIQUE(snapshot_id, liability_id)
);

CREATE INDEX IF NOT EXISTS idx_liability_balances_snapshot ON liability_balances(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_liability_balances_liability ON liability_balances(liability_id);

-- Snapshot totals cache for fast list queries
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
