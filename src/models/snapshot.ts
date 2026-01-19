export interface Snapshot {
  id: number;
  date: string; // ISO 8601 format (YYYY-MM-DD)
  created_at: string;
  updated_at?: string;
  notes?: string;
  total_assets_eur?: number;
  total_liabilities_eur?: number;
  net_worth_eur?: number;
}

export interface CreateSnapshotInput {
  date: string;
  notes?: string;
}

export interface UpdateSnapshotInput {
  notes?: string;
  total_assets_eur?: number;
  total_liabilities_eur?: number;
  net_worth_eur?: number;
}
