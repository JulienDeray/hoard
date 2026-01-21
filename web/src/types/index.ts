// Asset types
export type AssetClass = 'CRYPTO' | 'FIAT' | 'STOCK' | 'REAL_ESTATE' | 'COMMODITY' | 'OTHER';

export interface Asset {
  id: number;
  symbol: string;
  name: string;
  asset_class: AssetClass;
}

// Snapshot types
export interface Snapshot {
  id: number;
  date: string;
  notes?: string;
  total_assets_eur?: number;
  total_liabilities_eur?: number;
  net_worth_eur?: number;
  holdings_count?: number;
}

// Holding types
export interface HoldingWithAsset {
  id: number;
  snapshot_id: number;
  asset_id: number;
  amount: number;
  value_eur?: number;
  asset_symbol: string;
  asset_name: string;
  asset_class?: string;
}

export interface HoldingWithValue extends HoldingWithAsset {
  current_price_eur?: number;
  current_value_eur?: number;
}

// Allocation types
export type AllocationTargetType = 'ASSET' | 'ASSET_CLASS';

export interface AllocationComparison {
  target_type: AllocationTargetType;
  target_key: string;
  display_name: string;
  current_value: number;
  current_percentage: number;
  target_percentage: number;
  tolerance_pct: number;
  difference_percentage: number;
  difference_value: number;
  is_within_tolerance: boolean;
}

export interface AllocationSummary {
  date: string;
  total_value: number;
  currency: string;
  allocations: AllocationComparison[];
  has_targets: boolean;
  targets_sum_valid: boolean;
}

// API response types
export interface SnapshotDetail {
  snapshot: Snapshot;
  holdings: HoldingWithAsset[];
}

export interface PortfolioHolding {
  assetId: number;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  amount: number;
  valueEur: number;
  allocationPct: number;
}

export interface PortfolioSummary {
  date: string;
  totalAssetsEur: number;
  totalLiabilitiesEur: number;
  netWorthEur: number;
  holdings: PortfolioHolding[];
  assetCount: number;
  snapshotDate: string;
}
