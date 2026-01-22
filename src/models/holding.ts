export interface Holding {
  id: number;
  snapshot_id: number;
  asset_id: number;
  amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateHoldingInput {
  snapshot_id: number;
  asset_id: number;
  amount: number;
  notes?: string;
}

export interface UpdateHoldingInput {
  amount?: number;
  notes?: string;
}

// For display (joined with assets)
export interface HoldingWithAsset extends Holding {
  asset_symbol: string;
  asset_name: string;
  asset_class?: string;
}

// For display with computed current values
export interface HoldingWithValue extends HoldingWithAsset {
  current_price_eur?: number;
  current_value_eur?: number;
}

// Legacy input format for backward compatibility during migration
export interface LegacyCreateHoldingInput {
  snapshot_id: number;
  asset_symbol: string;
  asset_name: string;
  amount: number;
  acquisition_date?: string;
  acquisition_price_eur?: number;
  notes?: string;
}
