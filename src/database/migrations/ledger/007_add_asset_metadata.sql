-- Migration 007: Add metadata column to assets for property details
-- This column stores JSON-encoded property metadata (address, purchase details, etc.)

-- Add metadata column to assets table
ALTER TABLE assets ADD COLUMN metadata TEXT;

-- Create index on REAL_ESTATE asset class for fast filtering
CREATE INDEX IF NOT EXISTS idx_assets_real_estate
ON assets(asset_class)
WHERE asset_class = 'REAL_ESTATE';
