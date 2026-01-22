-- Migration v4: Remove redundant value_eur columns
-- Holdings: calculated from rates DB (single source of truth)
-- Liability balances: same as outstanding_amount (EUR only)

-- SQLite doesn't support DROP COLUMN directly, so we need to recreate tables

-- Step 1: Recreate holdings table without value_eur
CREATE TABLE holdings_new (
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

INSERT INTO holdings_new (id, snapshot_id, asset_id, amount, notes, created_at, updated_at)
SELECT id, snapshot_id, asset_id, amount, notes, created_at, updated_at FROM holdings;

DROP TABLE holdings;
ALTER TABLE holdings_new RENAME TO holdings;

CREATE INDEX IF NOT EXISTS idx_holdings_snapshot ON holdings(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_holdings_asset ON holdings(asset_id);

-- Step 2: Recreate liability_balances table without value_eur
CREATE TABLE liability_balances_new (
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

INSERT INTO liability_balances_new (id, snapshot_id, liability_id, outstanding_amount, created_at, updated_at)
SELECT id, snapshot_id, liability_id, outstanding_amount, created_at, updated_at FROM liability_balances;

DROP TABLE liability_balances;
ALTER TABLE liability_balances_new RENAME TO liability_balances;

CREATE INDEX IF NOT EXISTS idx_liability_balances_snapshot ON liability_balances(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_liability_balances_liability ON liability_balances(liability_id);
