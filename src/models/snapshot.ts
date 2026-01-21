export interface Snapshot {
  id: number;
  date: string; // ISO 8601 format (YYYY-MM-DD)
  created_at: string;
  updated_at?: string;
  notes?: string;
}

// Snapshot with calculated totals (computed from holdings + rates + liabilities)
export interface SnapshotWithTotals extends Snapshot {
  total_assets_eur: number;
  total_liabilities_eur: number;
  net_worth_eur: number;
}

export interface CreateSnapshotInput {
  date: string;
  notes?: string;
}

export interface UpdateSnapshotInput {
  notes?: string;
}

// Cached totals for fast list queries
export interface SnapshotTotalsCache {
  id?: number;
  snapshot_id: number;
  total_assets_eur: number;
  total_liabilities_eur: number;
  net_worth_eur: number;
  cached_at?: string;
}

export interface CreateSnapshotTotalsCacheInput {
  snapshot_id: number;
  total_assets_eur: number;
  total_liabilities_eur: number;
  net_worth_eur: number;
}
