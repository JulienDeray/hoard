-- Migration v5: Remove redundant total columns from snapshots
-- These values are now calculated dynamically from holdings + rates DB

-- Disable foreign keys to prevent cascade deletes during table recreation
PRAGMA foreign_keys = OFF;

-- SQLite doesn't support DROP COLUMN directly, need to recreate table
CREATE TABLE snapshots_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Copy data (excluding total columns)
INSERT INTO snapshots_new (id, date, notes, created_at, updated_at)
SELECT id, date, notes, created_at, updated_at FROM snapshots;

-- Drop old table and rename new one
DROP TABLE snapshots;
ALTER TABLE snapshots_new RENAME TO snapshots;

-- Recreate index
CREATE INDEX idx_snapshots_date ON snapshots(date);

-- Re-enable foreign keys
PRAGMA foreign_keys = ON;
