import { vi } from 'vitest';

export const mockCoinMarketCapService = () => ({
  getCurrentPrice: vi.fn().mockResolvedValue(45000),
  getMultipleCurrentPrices: vi.fn().mockResolvedValue([
    { symbol: 'BTC', price: 45000 },
    { symbol: 'ETH', price: 2750 },
  ]),
  getHistoricalPrice: vi.fn().mockResolvedValue(42000),
  getAssetInfoBySymbol: vi.fn().mockResolvedValue({
    symbol: 'BTC',
    name: 'Bitcoin',
    cmc_id: 1,
    current_price: 45000,
    market_cap: 900000000000,
  }),
});
