import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PortfolioService } from '../../src/services/portfolio.js';
import { mockSnapshot, mockHolding } from '../helpers/mock-factories.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  Logger: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('PortfolioService', () => {
  let service: PortfolioService;
  let mockLedgerRepo: any;
  let mockRatesRepo: any;
  let mockCmcService: any;

  beforeEach(() => {
    // Setup mocks
    mockLedgerRepo = {
      getHoldingsByDate: vi.fn(),
      getLatestHoldings: vi.fn(),
      getSnapshotByDate: vi.fn(),
      getLatestSnapshot: vi.fn(),
    };

    mockRatesRepo = {
      getCachedRate: vi.fn(),
      getHistoricalRate: vi.fn(),
      getLatestHistoricalRate: vi.fn(),
      updateCachedRate: vi.fn(),
    };

    mockCmcService = {
      getCurrentPrice: vi.fn(),
      getMultipleCurrentPrices: vi.fn(),
    };

    // Initialize service with mocks
    service = new PortfolioService(
      mockLedgerRepo,
      mockRatesRepo,
      mockCmcService,
      'EUR'
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPortfolioValue', () => {
    it('should calculate current portfolio value', async () => {
      // Arrange
      const holdings = [
        mockHolding({ asset_symbol: 'BTC', amount: 0.5 }),
        mockHolding({ id: 2, asset_symbol: 'ETH', amount: 10 }),
      ];
      const snapshot = mockSnapshot({ date: '2024-01-15' });

      mockLedgerRepo.getLatestHoldings.mockReturnValue(holdings);
      mockLedgerRepo.getLatestSnapshot.mockReturnValue(snapshot);
      mockRatesRepo.getCachedRate
        .mockReturnValueOnce({ price: 45000 }) // BTC
        .mockReturnValueOnce({ price: 2750 }); // ETH

      // Act
      const result = await service.getPortfolioValue();

      // Assert
      expect(result).toBeDefined();
      expect(result?.totalValue).toBe(0.5 * 45000 + 10 * 2750); // 22500 + 27500
      expect(result?.holdings).toHaveLength(2);
      expect(result?.holdings[0].current_price_eur).toBe(45000);
      expect(result?.holdings[1].current_price_eur).toBe(2750);
    });

    it('should calculate historical portfolio value', async () => {
      // Arrange
      const date = '2024-01-15';
      const holdings = [mockHolding({ asset_symbol: 'BTC', amount: 0.5 })];
      const snapshot = mockSnapshot({ date });

      mockLedgerRepo.getHoldingsByDate.mockReturnValue(holdings);
      mockLedgerRepo.getSnapshotByDate.mockReturnValue(snapshot);
      mockRatesRepo.getHistoricalRate.mockReturnValue({ price: 42000 });

      // Act
      const result = await service.getPortfolioValue(date);

      // Assert
      expect(result?.totalValue).toBe(0.5 * 42000); // 21000
      expect(mockRatesRepo.getHistoricalRate).toHaveBeenCalledWith(
        'BTC',
        date,
        'EUR'
      );
    });

    it('should return null when no holdings exist', async () => {
      // Arrange
      mockLedgerRepo.getLatestHoldings.mockReturnValue([]);

      // Act
      const result = await service.getPortfolioValue();

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when no snapshot exists', async () => {
      // Arrange
      const holdings = [mockHolding()];
      mockLedgerRepo.getLatestHoldings.mockReturnValue(holdings);
      mockLedgerRepo.getLatestSnapshot.mockReturnValue(undefined);

      // Act
      const result = await service.getPortfolioValue();

      // Assert
      expect(result).toBeNull();
    });

    it('should handle missing prices gracefully', async () => {
      // Arrange
      const holdings = [mockHolding({ asset_symbol: 'BTC', amount: 0.5 })];
      const snapshot = mockSnapshot();

      mockLedgerRepo.getLatestHoldings.mockReturnValue(holdings);
      mockLedgerRepo.getLatestSnapshot.mockReturnValue(snapshot);
      mockRatesRepo.getCachedRate.mockReturnValue(null);
      mockRatesRepo.getLatestHistoricalRate.mockReturnValue(undefined);
      mockCmcService.getCurrentPrice.mockRejectedValue(new Error('API error'));

      // Act
      const result = await service.getPortfolioValue();

      // Assert
      expect(result).toBeDefined();
      expect(result?.holdings[0].current_price_eur).toBeUndefined();
      expect(result?.holdings[0].current_value_eur).toBeUndefined();
      expect(result?.totalValue).toBe(0);
    });
  });

  describe('enrichHoldingsWithPrices', () => {
    it('should use cached prices for current date', async () => {
      // Arrange
      const holdings = [mockHolding({ asset_symbol: 'BTC', amount: 0.5 })];
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 45000 });

      // Act
      const result = await service.enrichHoldingsWithPrices(holdings, null);

      // Assert
      expect(result[0].current_price_eur).toBe(45000);
      expect(result[0].current_value_eur).toBe(0.5 * 45000);
      expect(mockRatesRepo.getCachedRate).toHaveBeenCalledWith('BTC', 'EUR');
      expect(mockCmcService.getCurrentPrice).not.toHaveBeenCalled();
    });

    it('should use historical fallback when cache misses', async () => {
      // Arrange
      const holdings = [mockHolding({ asset_symbol: 'BTC', amount: 0.5 })];
      mockRatesRepo.getCachedRate.mockReturnValue(null);
      mockRatesRepo.getLatestHistoricalRate.mockReturnValue({ price: 44000 });

      // Act
      const result = await service.enrichHoldingsWithPrices(holdings, null);

      // Assert
      expect(result[0].current_price_eur).toBe(44000);
      expect(result[0].current_value_eur).toBe(0.5 * 44000);
      expect(mockRatesRepo.getLatestHistoricalRate).toHaveBeenCalledWith(
        'BTC',
        'EUR'
      );
      // Should NOT call CMC API when historical data exists
      expect(mockCmcService.getCurrentPrice).not.toHaveBeenCalled();
    });

    it('should fetch from API only when cache AND historical miss', async () => {
      // Arrange
      const holdings = [mockHolding({ asset_symbol: 'BTC', amount: 0.5 })];
      mockRatesRepo.getCachedRate.mockReturnValue(null);
      mockRatesRepo.getLatestHistoricalRate.mockReturnValue(undefined);
      mockCmcService.getCurrentPrice.mockResolvedValue(45000);

      // Act
      const result = await service.enrichHoldingsWithPrices(holdings, null);

      // Assert
      expect(result[0].current_price_eur).toBe(45000);
      expect(mockCmcService.getCurrentPrice).toHaveBeenCalledWith('BTC', 'EUR');
      expect(mockRatesRepo.updateCachedRate).toHaveBeenCalledWith(
        'BTC',
        45000,
        'EUR'
      );
    });

    it('should use historical prices for specific dates', async () => {
      // Arrange
      const holdings = [mockHolding({ asset_symbol: 'BTC', amount: 0.5 })];
      const date = '2024-01-15';
      mockRatesRepo.getHistoricalRate.mockReturnValue({ price: 42000 });

      // Act
      const result = await service.enrichHoldingsWithPrices(holdings, date);

      // Assert
      expect(result[0].current_price_eur).toBe(42000);
      expect(mockRatesRepo.getHistoricalRate).toHaveBeenCalledWith(
        'BTC',
        date,
        'EUR'
      );
      expect(mockCmcService.getCurrentPrice).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully when no historical data', async () => {
      // Arrange
      const holdings = [mockHolding({ asset_symbol: 'BTC', amount: 0.5 })];
      mockRatesRepo.getCachedRate.mockReturnValue(null);
      mockRatesRepo.getLatestHistoricalRate.mockReturnValue(undefined);
      mockCmcService.getCurrentPrice.mockRejectedValue(new Error('API error'));

      // Act
      const result = await service.enrichHoldingsWithPrices(holdings, null);

      // Assert
      expect(result[0].current_price_eur).toBeUndefined();
      expect(result[0].current_value_eur).toBeUndefined();
    });

    it('should enrich multiple holdings', async () => {
      // Arrange
      const holdings = [
        mockHolding({ asset_symbol: 'BTC', amount: 0.5 }),
        mockHolding({ id: 2, asset_symbol: 'ETH', amount: 10 }),
      ];
      mockRatesRepo.getCachedRate
        .mockReturnValueOnce({ price: 45000 })
        .mockReturnValueOnce({ price: 2750 });

      // Act
      const result = await service.enrichHoldingsWithPrices(holdings, null);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].current_value_eur).toBe(0.5 * 45000);
      expect(result[1].current_value_eur).toBe(10 * 2750);
    });

    it('should handle empty holdings array', async () => {
      // Arrange
      const holdings: any[] = [];

      // Act
      const result = await service.enrichHoldingsWithPrices(holdings, null);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle holdings with very small amounts', async () => {
      // Arrange
      const holdings = [
        mockHolding({ asset_symbol: 'BTC', amount: 0.00000001 }),
      ];
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 45000 });

      // Act
      const result = await service.enrichHoldingsWithPrices(holdings, null);

      // Assert
      expect(result[0].current_value_eur).toBe(0.00000001 * 45000);
    });
  });

  describe('fetchAndCachePrices', () => {
    it('should fetch and cache multiple prices', async () => {
      // Arrange
      const symbols = ['BTC', 'ETH', 'SOL'];
      const prices = new Map([
        ['BTC', 45000],
        ['ETH', 2750],
        ['SOL', 100],
      ]);
      mockCmcService.getMultipleCurrentPrices.mockResolvedValue(prices);

      // Act
      await service.fetchAndCachePrices(symbols);

      // Assert
      expect(mockCmcService.getMultipleCurrentPrices).toHaveBeenCalledWith(
        symbols,
        'EUR'
      );
      expect(mockRatesRepo.updateCachedRate).toHaveBeenCalledTimes(3);
      expect(mockRatesRepo.updateCachedRate).toHaveBeenCalledWith(
        'BTC',
        45000,
        'EUR'
      );
      expect(mockRatesRepo.updateCachedRate).toHaveBeenCalledWith(
        'ETH',
        2750,
        'EUR'
      );
      expect(mockRatesRepo.updateCachedRate).toHaveBeenCalledWith(
        'SOL',
        100,
        'EUR'
      );
    });

    it('should throw on API error', async () => {
      // Arrange
      const symbols = ['BTC'];
      mockCmcService.getMultipleCurrentPrices.mockRejectedValue(
        new Error('API error')
      );

      // Act & Assert
      await expect(service.fetchAndCachePrices(symbols)).rejects.toThrow(
        'API error'
      );
    });

    it('should handle empty symbols array', async () => {
      // Arrange
      const symbols: string[] = [];
      mockCmcService.getMultipleCurrentPrices.mockResolvedValue(new Map());

      // Act
      await service.fetchAndCachePrices(symbols);

      // Assert
      expect(mockRatesRepo.updateCachedRate).not.toHaveBeenCalled();
    });
  });
});
