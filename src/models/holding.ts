export interface Holding {
  id: number;
  snapshot_id: number;
  asset_symbol: string;
  asset_name: string;
  amount: number;
  acquisition_date?: string;
  acquisition_price_eur?: number;
  notes?: string;
}

export interface CreateHoldingInput {
  snapshot_id: number;
  asset_symbol: string;
  asset_name: string;
  amount: number;
  acquisition_date?: string;
  acquisition_price_eur?: number;
  notes?: string;
}

export interface HoldingWithValue extends Holding {
  current_price_eur?: number;
  current_value_eur?: number;
}
