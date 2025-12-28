-- Allocation Targets Migration
-- Stores portfolio allocation targets with wildcard support

CREATE TABLE IF NOT EXISTS allocation_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_symbol TEXT NOT NULL UNIQUE,  -- BTC, ETH, or special "OTHER" for wildcard
    target_percentage REAL NOT NULL,     -- Target allocation percentage (0-100)
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    CONSTRAINT valid_percentage CHECK (target_percentage >= 0 AND target_percentage <= 100)
);

CREATE INDEX IF NOT EXISTS idx_allocation_targets_symbol ON allocation_targets(asset_symbol);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_allocation_targets_timestamp
AFTER UPDATE ON allocation_targets
BEGIN
    UPDATE allocation_targets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
