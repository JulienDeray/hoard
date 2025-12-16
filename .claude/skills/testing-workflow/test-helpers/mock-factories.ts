import type { Snapshot, Holding, Asset, Rate } from '../../src/models/index.js';

export const mockSnapshot = (overrides?: Partial<Snapshot>): Snapshot => ({
  id: 1,
  date: '2024-01-15',
  notes: 'Test snapshot',
  ...overrides,
});

export const mockHolding = (overrides?: Partial<Holding>): Holding => ({
  id: 1,
  snapshot_id: 1,
  asset_symbol: 'BTC',
  amount: 0.5,
  ...overrides,
});

export const mockAsset = (overrides?: Partial<Asset>): Asset => ({
  symbol: 'BTC',
  name: 'Bitcoin',
  cmc_id: 1,
  ...overrides,
});

export const mockRate = (overrides?: Partial<Rate>): Rate => ({
  symbol: 'BTC',
  currency: 'EUR',
  price: 45000,
  timestamp: new Date().toISOString(),
  ...overrides,
});

export const mockPortfolioSummary = () => ({
  totalValue: 50000,
  holdings: [
    {
      asset_symbol: 'BTC',
      asset_name: 'Bitcoin',
      amount: 0.5,
      price: 45000,
      value: 22500,
      percentage: 45,
    },
    {
      asset_symbol: 'ETH',
      asset_name: 'Ethereum',
      amount: 10,
      price: 2750,
      value: 27500,
      percentage: 55,
    },
  ],
});
