-- Migration v3: Multi-asset wealth management schema
-- Transforms database from crypto-only to multi-asset with liabilities support

-- ============================================================================
-- Step 1: Create schema_version table if not exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Mark v1 and v2 as applied if they haven't been tracked yet
INSERT OR IGNORE INTO schema_version (version, description, applied_at)
VALUES (1, 'Initial schema', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_version (version, description, applied_at)
VALUES (2, 'Allocation targets', CURRENT_TIMESTAMP);

-- ============================================================================
-- Step 2: Transform assets table (symbol PK → id PK)
-- ============================================================================

-- Create new assets table with auto-increment id
CREATE TABLE IF NOT EXISTS assets_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    asset_class TEXT NOT NULL DEFAULT 'CRYPTO',
    valuation_source TEXT NOT NULL DEFAULT 'CMC',
    external_id TEXT,
    currency TEXT NOT NULL DEFAULT 'EUR',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_asset_class CHECK (asset_class IN ('CRYPTO', 'FIAT', 'STOCK', 'REAL_ESTATE', 'COMMODITY', 'OTHER')),
    CONSTRAINT valid_valuation_source CHECK (valuation_source IN ('CMC', 'MANUAL', 'YAHOO', 'CUSTOM_API'))
);

-- Migrate data from old assets table
INSERT INTO assets_new (symbol, name, external_id, is_active, created_at, updated_at)
SELECT
    symbol,
    name,
    CAST(cmc_id AS TEXT),
    is_active,
    COALESCE(last_updated, CURRENT_TIMESTAMP),
    COALESCE(last_updated, CURRENT_TIMESTAMP)
FROM assets;

-- Drop old assets table and rename new one
DROP TABLE IF EXISTS assets;
ALTER TABLE assets_new RENAME TO assets;

-- Create indexes on assets
CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);
CREATE INDEX IF NOT EXISTS idx_assets_class ON assets(asset_class);

-- Create trigger for updated_at on assets
CREATE TRIGGER IF NOT EXISTS update_assets_timestamp
AFTER UPDATE ON assets
BEGIN
    UPDATE assets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Step 3: Transform holdings table (asset_symbol → asset_id FK)
-- ============================================================================

-- Create new holdings table with asset_id FK
CREATE TABLE IF NOT EXISTS holdings_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL,
    asset_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    value_eur REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    CONSTRAINT positive_amount CHECK (amount >= 0)
);

-- Migrate data from old holdings table
-- First, handle any orphaned holdings by creating missing assets
INSERT OR IGNORE INTO assets (symbol, name, asset_class, valuation_source, created_at, updated_at)
SELECT DISTINCT
    h.asset_symbol,
    COALESCE(h.asset_name, h.asset_symbol),
    'CRYPTO',
    'CMC',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM holdings h
WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.symbol = h.asset_symbol);

-- Now migrate holdings with asset_id lookup
INSERT INTO holdings_new (id, snapshot_id, asset_id, amount, notes, created_at, updated_at)
SELECT
    h.id,
    h.snapshot_id,
    a.id,
    h.amount,
    h.notes,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM holdings h
JOIN assets a ON a.symbol = h.asset_symbol;

-- Drop old holdings table and rename new one
DROP TABLE IF EXISTS holdings;
ALTER TABLE holdings_new RENAME TO holdings;

-- Create indexes on holdings
CREATE INDEX IF NOT EXISTS idx_holdings_snapshot ON holdings(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_holdings_asset ON holdings(asset_id);

-- Create trigger for updated_at on holdings
CREATE TRIGGER IF NOT EXISTS update_holdings_timestamp
AFTER UPDATE ON holdings
BEGIN
    UPDATE holdings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Step 4: Alter snapshots table (add totals columns)
-- ============================================================================

-- Add new columns to snapshots
ALTER TABLE snapshots ADD COLUMN total_assets_eur REAL;
ALTER TABLE snapshots ADD COLUMN total_liabilities_eur REAL DEFAULT 0;
ALTER TABLE snapshots ADD COLUMN net_worth_eur REAL;
ALTER TABLE snapshots ADD COLUMN updated_at TEXT;

-- Create trigger for updated_at on snapshots
CREATE TRIGGER IF NOT EXISTS update_snapshots_timestamp
AFTER UPDATE ON snapshots
BEGIN
    UPDATE snapshots SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Step 5: Transform allocation_targets table
-- ============================================================================

-- Create new allocation_targets table with target_type
CREATE TABLE IF NOT EXISTS allocation_targets_new (
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

-- Migrate data from old allocation_targets table
INSERT INTO allocation_targets_new (id, target_type, target_key, target_percentage, created_at, updated_at, notes)
SELECT
    id,
    'ASSET',
    asset_symbol,
    target_percentage,
    created_at,
    updated_at,
    notes
FROM allocation_targets;

-- Drop old table and rename new one
DROP TABLE IF EXISTS allocation_targets;
ALTER TABLE allocation_targets_new RENAME TO allocation_targets;

-- Create index on allocation_targets
CREATE INDEX IF NOT EXISTS idx_allocation_targets_key ON allocation_targets(target_type, target_key);

-- Create trigger for updated_at on allocation_targets
CREATE TRIGGER IF NOT EXISTS update_allocation_targets_timestamp_new
AFTER UPDATE ON allocation_targets
BEGIN
    UPDATE allocation_targets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Step 6: Create liabilities table
-- ============================================================================

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

-- Create trigger for updated_at on liabilities
CREATE TRIGGER IF NOT EXISTS update_liabilities_timestamp
AFTER UPDATE ON liabilities
BEGIN
    UPDATE liabilities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Step 7: Create liability_balances table
-- ============================================================================

CREATE TABLE IF NOT EXISTS liability_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL,
    liability_id INTEGER NOT NULL,
    outstanding_amount REAL NOT NULL,
    value_eur REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
    FOREIGN KEY (liability_id) REFERENCES liabilities(id) ON DELETE CASCADE,
    CONSTRAINT positive_outstanding CHECK (outstanding_amount >= 0),
    UNIQUE(snapshot_id, liability_id)
);

CREATE INDEX IF NOT EXISTS idx_liability_balances_snapshot ON liability_balances(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_liability_balances_liability ON liability_balances(liability_id);

-- Create trigger for updated_at on liability_balances
CREATE TRIGGER IF NOT EXISTS update_liability_balances_timestamp
AFTER UPDATE ON liability_balances
BEGIN
    UPDATE liability_balances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================================
-- Done: v3 migration complete
-- Note: Backfill of value_eur columns is done via TypeScript after this SQL
-- ============================================================================
