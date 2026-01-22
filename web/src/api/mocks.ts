import type {
  Snapshot,
  SnapshotDetail,
  HoldingWithAsset,
  PortfolioSummary,
  AllocationSummary,
  AllocationComparison,
} from '@/types';

// Mock snapshots (totals are calculated dynamically in detail view)
export const mockSnapshots: Snapshot[] = [
  {
    id: 1,
    date: '2024-12-01',
    notes: 'December 2024 portfolio snapshot',
  },
  {
    id: 2,
    date: '2025-01-01',
    notes: 'January 2025 - New year portfolio',
  },
  {
    id: 3,
    date: '2025-02-01',
    notes: 'February 2025 snapshot',
  },
];

// Mock holdings for each snapshot (values are calculated from rates DB in production)
const mockHoldingsMap: Record<string, HoldingWithAsset[]> = {
  '2024-12-01': [
    { id: 1, snapshot_id: 1, asset_id: 1, amount: 0.5, asset_symbol: 'BTC', asset_name: 'Bitcoin', asset_class: 'CRYPTO' },
    { id: 2, snapshot_id: 1, asset_id: 2, amount: 5, asset_symbol: 'ETH', asset_name: 'Ethereum', asset_class: 'CRYPTO' },
    { id: 3, snapshot_id: 1, asset_id: 3, amount: 50, asset_symbol: 'SOL', asset_name: 'Solana', asset_class: 'CRYPTO' },
    { id: 4, snapshot_id: 1, asset_id: 4, amount: 5000, asset_symbol: 'USDC', asset_name: 'USD Coin', asset_class: 'CRYPTO' },
    { id: 5, snapshot_id: 1, asset_id: 5, amount: 5000, asset_symbol: 'ADA', asset_name: 'Cardano', asset_class: 'CRYPTO' },
    { id: 6, snapshot_id: 1, asset_id: 6, amount: 200, asset_symbol: 'DOT', asset_name: 'Polkadot', asset_class: 'CRYPTO' },
  ],
  '2025-01-01': [
    { id: 7, snapshot_id: 2, asset_id: 1, amount: 0.5, asset_symbol: 'BTC', asset_name: 'Bitcoin', asset_class: 'CRYPTO' },
    { id: 8, snapshot_id: 2, asset_id: 2, amount: 5.5, asset_symbol: 'ETH', asset_name: 'Ethereum', asset_class: 'CRYPTO' },
    { id: 9, snapshot_id: 2, asset_id: 3, amount: 60, asset_symbol: 'SOL', asset_name: 'Solana', asset_class: 'CRYPTO' },
    { id: 10, snapshot_id: 2, asset_id: 4, amount: 5000, asset_symbol: 'USDC', asset_name: 'USD Coin', asset_class: 'CRYPTO' },
    { id: 11, snapshot_id: 2, asset_id: 5, amount: 4000, asset_symbol: 'ADA', asset_name: 'Cardano', asset_class: 'CRYPTO' },
    { id: 12, snapshot_id: 2, asset_id: 6, amount: 200, asset_symbol: 'DOT', asset_name: 'Polkadot', asset_class: 'CRYPTO' },
  ],
  '2025-02-01': [
    { id: 13, snapshot_id: 3, asset_id: 1, amount: 0.55, asset_symbol: 'BTC', asset_name: 'Bitcoin', asset_class: 'CRYPTO' },
    { id: 14, snapshot_id: 3, asset_id: 2, amount: 6, asset_symbol: 'ETH', asset_name: 'Ethereum', asset_class: 'CRYPTO' },
    { id: 15, snapshot_id: 3, asset_id: 3, amount: 70, asset_symbol: 'SOL', asset_name: 'Solana', asset_class: 'CRYPTO' },
    { id: 16, snapshot_id: 3, asset_id: 4, amount: 5000, asset_symbol: 'USDC', asset_name: 'USD Coin', asset_class: 'CRYPTO' },
    { id: 17, snapshot_id: 3, asset_id: 5, amount: 4000, asset_symbol: 'ADA', asset_name: 'Cardano', asset_class: 'CRYPTO' },
    { id: 18, snapshot_id: 3, asset_id: 6, amount: 200, asset_symbol: 'DOT', asset_name: 'Polkadot', asset_class: 'CRYPTO' },
  ],
};

// Mock allocation targets and comparison
const mockAllocations: AllocationComparison[] = [
  {
    target_type: 'ASSET',
    target_key: 'BTC',
    display_name: 'Bitcoin',
    current_value: 26000,
    current_percentage: 44.4,
    target_percentage: 40,
    tolerance_pct: 5,
    difference_percentage: 4.4,
    difference_value: 2574,
    is_within_tolerance: true,
  },
  {
    target_type: 'ASSET',
    target_key: 'ETH',
    display_name: 'Ethereum',
    current_value: 14000,
    current_percentage: 23.9,
    target_percentage: 25,
    tolerance_pct: 5,
    difference_percentage: -1.1,
    difference_value: -644,
    is_within_tolerance: true,
  },
  {
    target_type: 'ASSET',
    target_key: 'SOL',
    display_name: 'Solana',
    current_value: 8500,
    current_percentage: 14.5,
    target_percentage: 15,
    tolerance_pct: 3,
    difference_percentage: -0.5,
    difference_value: -293,
    is_within_tolerance: true,
  },
  {
    target_type: 'ASSET',
    target_key: 'USDC',
    display_name: 'USD Coin',
    current_value: 5000,
    current_percentage: 8.5,
    target_percentage: 10,
    tolerance_pct: 2,
    difference_percentage: -1.5,
    difference_value: -878,
    is_within_tolerance: true,
  },
  {
    target_type: 'ASSET',
    target_key: 'ADA',
    display_name: 'Cardano',
    current_value: 3000,
    current_percentage: 5.1,
    target_percentage: 5,
    tolerance_pct: 2,
    difference_percentage: 0.1,
    difference_value: 59,
    is_within_tolerance: true,
  },
  {
    target_type: 'ASSET',
    target_key: 'DOT',
    display_name: 'Polkadot',
    current_value: 2000,
    current_percentage: 3.4,
    target_percentage: 5,
    tolerance_pct: 2,
    difference_percentage: -1.6,
    difference_value: -936,
    is_within_tolerance: true,
  },
];

// Mock API implementations
export async function getSnapshots(): Promise<Snapshot[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [...mockSnapshots].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getSnapshot(date: string): Promise<SnapshotDetail> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const snapshot = mockSnapshots.find((s) => s.date === date);
  if (!snapshot) {
    throw new Error(`Snapshot not found for date: ${date}`);
  }

  const holdings = mockHoldingsMap[date] || [];

  return { snapshot, holdings, liabilityBalances: [] };
}

// Mock values for portfolio holdings (in production these come from rates DB)
const mockHoldingValues: Record<number, number> = {
  1: 26000, // BTC
  2: 14000, // ETH
  3: 8500,  // SOL
  4: 5000,  // USDC
  5: 3000,  // ADA
  6: 2000,  // DOT
};

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  await new Promise((resolve) => setTimeout(resolve, 250));

  const latestSnapshot = mockSnapshots[mockSnapshots.length - 1];
  const holdings = mockHoldingsMap[latestSnapshot.date] || [];
  const totalAssetsEur = latestSnapshot.total_assets_eur || 0;

  const portfolioHoldings = holdings.map((h) => {
    const valueEur = mockHoldingValues[h.asset_id] || 0;
    return {
      assetId: h.asset_id,
      symbol: h.asset_symbol,
      name: h.asset_name,
      assetClass: h.asset_class as 'CRYPTO' | 'FIAT' | 'STOCK' | 'REAL_ESTATE' | 'COMMODITY' | 'OTHER',
      amount: h.amount,
      valueEur,
      allocationPct: totalAssetsEur > 0 ? (valueEur / totalAssetsEur) * 100 : 0,
    };
  });

  return {
    date: latestSnapshot.date,
    totalAssetsEur,
    totalLiabilitiesEur: 0,
    netWorthEur: totalAssetsEur,
    holdings: portfolioHoldings,
    assetCount: holdings.length,
    snapshotDate: latestSnapshot.date,
  };
}

export async function getAllocationComparison(): Promise<AllocationSummary> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const latestSnapshot = mockSnapshots[mockSnapshots.length - 1];

  return {
    date: latestSnapshot.date,
    total_value: latestSnapshot.total_assets_eur || 0,
    currency: 'EUR',
    allocations: mockAllocations,
    has_targets: true,
    targets_sum_valid: true,
  };
}
