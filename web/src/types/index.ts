// Asset types
export type AssetClass = 'CRYPTO' | 'FIAT' | 'STOCK' | 'REAL_ESTATE' | 'COMMODITY' | 'OTHER';

// Liability types
export type LiabilityType = 'LOAN' | 'MORTGAGE' | 'CREDIT_LINE';

export interface Liability {
  id: number;
  name: string;
  liabilityType: LiabilityType;
  linkedAssetId?: number;
  originalAmount: number;
  currency: string;
  interestRate?: number;
  startDate?: string;
  termMonths?: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiabilityBalance {
  id: number;
  snapshotId: number;
  liabilityId: number;
  outstandingAmount: number;
}

export interface LiabilityBalanceWithDetails extends LiabilityBalance {
  liabilityName: string;
  liabilityType: LiabilityType;
  originalAmount: number;
  currency: string;
  interestRate?: number;
}

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
  asset_symbol: string;
  asset_name: string;
  asset_class?: string;
  notes?: string;
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
  holdings: HoldingWithValue[];
  liabilityBalances: LiabilityBalanceWithDetails[];
}

export interface PreviousSnapshotData {
  date: string;
  holdings: HoldingWithAsset[];
  liabilityBalances: LiabilityBalanceWithDetails[];
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

// Form-specific types
export interface FormHolding {
  tempId: string;
  assetId: number;
  assetSymbol: string;
  assetName: string;
  assetClass: string;
  amount: string;
  originalAmount?: number;
  priceOverride?: string;
}

export interface FormLiabilityBalance {
  tempId: string;
  liabilityId: number;
  liabilityName: string;
  liabilityType: LiabilityType;
  originalAmount: number;
  outstandingAmount: string;
  originalOutstandingAmount?: number;
}

export interface SnapshotFormData {
  date: string;
  notes: string;
  holdings: FormHolding[];
  liabilityBalances: FormLiabilityBalance[];
}

// API request/response types for mutations
export interface CreateSnapshotRequest {
  date: string;
  notes?: string;
}

export interface AddHoldingRequest {
  assetId: number;
  amount: number;
  priceOverride?: number;
}

export interface UpdateHoldingRequest {
  amount?: number;
  notes?: string;
}

export interface HoldingResponse {
  holding: HoldingWithAsset;
  isUpdate?: boolean;
  previousAmount?: number;
}

export interface DeleteSnapshotResponse {
  snapshot: Snapshot;
  deletedHoldingsCount: number;
}

export interface DeleteHoldingResponse {
  deletedHolding: HoldingWithAsset;
  remainingHoldingsCount: number;
}

// Liability API request/response types
export interface AddLiabilityBalanceRequest {
  liabilityId: number;
  outstandingAmount: number;
}

export interface UpdateLiabilityBalanceRequest {
  outstandingAmount: number;
}

export interface LiabilityBalanceResponse {
  liabilityBalance: LiabilityBalanceWithDetails;
  isUpdate?: boolean;
  previousAmount?: number;
}

export interface DeleteLiabilityBalanceResponse {
  deleted: boolean;
}
