export type LiabilityType = 'LOAN' | 'MORTGAGE' | 'CREDIT_LINE';

export interface Liability {
  id: number;
  name: string;
  liability_type: LiabilityType;
  linked_asset_id?: number;
  original_amount: number;
  currency: string;
  interest_rate?: number;
  start_date?: string;
  term_months?: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLiabilityInput {
  name: string;
  liability_type: LiabilityType;
  linked_asset_id?: number;
  original_amount: number;
  currency?: string;
  interest_rate?: number;
  start_date?: string;
  term_months?: number;
  notes?: string;
}

export interface UpdateLiabilityInput {
  name?: string;
  liability_type?: LiabilityType;
  linked_asset_id?: number;
  interest_rate?: number;
  is_active?: boolean;
  notes?: string;
}

export interface LiabilityBalance {
  id: number;
  snapshot_id: number;
  liability_id: number;
  outstanding_amount: number;
  value_eur?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateLiabilityBalanceInput {
  snapshot_id: number;
  liability_id: number;
  outstanding_amount: number;
  value_eur?: number;
}

export interface UpdateLiabilityBalanceInput {
  outstanding_amount?: number;
  value_eur?: number;
}

// For display (joined with liabilities)
export interface LiabilityBalanceWithDetails extends LiabilityBalance {
  liability_name: string;
  liability_type: LiabilityType;
  original_amount: number;
  currency: string;
  interest_rate?: number;
}
