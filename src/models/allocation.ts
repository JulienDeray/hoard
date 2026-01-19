export type AllocationTargetType = 'ASSET' | 'ASSET_CLASS';

export interface AllocationTarget {
  id: number;
  target_type: AllocationTargetType;
  target_key: string; // Was asset_symbol, now generic key (can be symbol or asset class)
  target_percentage: number;
  tolerance_pct?: number;
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface CreateAllocationTargetInput {
  target_type?: AllocationTargetType;
  target_key: string;
  target_percentage: number;
  tolerance_pct?: number;
  notes?: string;
}

export interface UpdateAllocationTargetInput {
  target_percentage?: number;
  tolerance_pct?: number;
  notes?: string;
}

// Legacy support - maps old asset_symbol field
export interface LegacyCreateAllocationTargetInput {
  asset_symbol: string;
  target_percentage: number;
  notes?: string;
}

export interface AllocationComparison {
  target_type: AllocationTargetType;
  target_key: string;
  display_name: string; // For UI display
  current_value: number;
  current_percentage: number;
  target_percentage: number;
  tolerance_pct: number;
  difference_percentage: number; // negative = underweight, positive = overweight
  difference_value: number; // EUR amount to buy (negative) or sell (positive)
  is_within_tolerance: boolean;
}

export interface AllocationSummary {
  date: string;
  total_value: number;
  currency: string;
  allocations: AllocationComparison[];
  has_targets: boolean;
  targets_sum_valid: boolean; // true if targets sum to 100%
}

export interface RebalancingSuggestion {
  date: string;
  total_value: number;
  currency: string;
  actions: RebalancingAction[];
  is_balanced: boolean; // true if all within tolerance
}

export interface RebalancingAction {
  target_type: AllocationTargetType;
  target_key: string;
  display_name: string;
  action: 'buy' | 'sell' | 'hold';
  amount_eur: number;
  current_percentage: number;
  target_percentage: number;
}
