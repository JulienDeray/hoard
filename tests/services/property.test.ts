import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PropertyService } from '../../src/services/property.js';
import {
  PropertyNotFoundError,
  InvalidPropertyTypeError,
  InvalidPropertyValueError,
} from '../../src/errors/index.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  Logger: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('PropertyService', () => {
  let service: PropertyService;
  let mockLedgerRepo: any;
  let mockRatesRepo: any;

  beforeEach(() => {
    // Setup mocks
    mockLedgerRepo = {
      listRealEstateAssets: vi.fn(),
      getAssetById: vi.fn(),
      getAssetBySymbol: vi.fn(),
      createAsset: vi.fn(),
      updateAsset: vi.fn(),
      getMortgageByLinkedAsset: vi.fn(),
      getLatestMortgageBalance: vi.fn(),
      getLatestSnapshot: vi.fn(),
      createLiability: vi.fn(),
      createLiabilityBalance: vi.fn(),
      getSnapshotsWithAsset: vi.fn(),
      invalidateSnapshotCache: vi.fn(),
      invalidateSnapshotCacheForAsset: vi.fn(),
    };

    mockRatesRepo = {
      getCachedRate: vi.fn(),
      getHistoricalRatesForAsset: vi.fn(),
      saveHistoricalRate: vi.fn(),
      updateCachedRate: vi.fn(),
    };

    // Initialize service with mocks
    service = new PropertyService(mockLedgerRepo, mockRatesRepo, 'EUR');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create a mock property asset
  const mockPropertyAsset = (overrides: any = {}) => ({
    id: 1,
    symbol: 'PROP-LISBON-001',
    name: 'Lisbon Apartment',
    asset_class: 'REAL_ESTATE',
    valuation_source: 'MANUAL',
    currency: 'EUR',
    is_active: true,
    metadata: JSON.stringify({
      propertyType: 'PRIMARY_RESIDENCE',
      address: '123 Rua Test',
      city: 'Lisbon',
      country: 'Portugal',
    }),
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });

  describe('create', () => {
    it('should create a property with metadata', () => {
      // Arrange
      const input = {
        name: 'Lisbon Apartment',
        propertyType: 'PRIMARY_RESIDENCE' as const,
        currentValue: 450000,
        city: 'Lisbon',
        country: 'Portugal',
      };

      mockLedgerRepo.listRealEstateAssets.mockReturnValue([]);
      mockLedgerRepo.createAsset.mockReturnValue(mockPropertyAsset());
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 450000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue(null);

      // Act
      const result = service.create(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Lisbon Apartment');
      expect(result.currentValue).toBe(450000);
      expect(result.equity).toBe(450000);
      expect(result.mortgageBalance).toBeNull();
      expect(mockLedgerRepo.createAsset).toHaveBeenCalled();
      expect(mockRatesRepo.saveHistoricalRate).toHaveBeenCalled();
      expect(mockRatesRepo.updateCachedRate).toHaveBeenCalledWith(
        expect.stringMatching(/^PROP-/),
        450000,
        'EUR'
      );
    });

    it('should create a property with linked mortgage', () => {
      // Arrange
      const input = {
        name: 'Lisbon Apartment',
        propertyType: 'PRIMARY_RESIDENCE' as const,
        currentValue: 450000,
        mortgage: {
          name: 'Lisbon Mortgage',
          originalAmount: 360000,
          outstandingAmount: 320000,
          interestRate: 3.5,
        },
      };

      mockLedgerRepo.listRealEstateAssets.mockReturnValue([]);
      mockLedgerRepo.createAsset.mockReturnValue(mockPropertyAsset());
      mockLedgerRepo.createLiability.mockReturnValue({ id: 1 });
      mockLedgerRepo.getLatestSnapshot.mockReturnValue({ id: 10, date: '2024-01-01' });
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 450000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue(null);

      // Act
      const result = service.create(input);

      // Assert
      expect(mockLedgerRepo.createLiability).toHaveBeenCalledWith({
        name: 'Lisbon Mortgage',
        liability_type: 'MORTGAGE',
        linked_asset_id: 1,
        original_amount: 360000,
        currency: 'EUR',
        interest_rate: 3.5,
        start_date: undefined,
        term_months: undefined,
      });
      // Verify liability balance is created in latest snapshot
      expect(mockLedgerRepo.createLiabilityBalance).toHaveBeenCalledWith({
        snapshot_id: 10,
        liability_id: 1,
        outstanding_amount: 320000,
      });
    });

    it('should throw InvalidPropertyTypeError for invalid property type', () => {
      // Arrange
      const input = {
        name: 'Test Property',
        propertyType: 'INVALID_TYPE' as any,
        currentValue: 100000,
      };

      // Act & Assert
      expect(() => service.create(input)).toThrow(InvalidPropertyTypeError);
    });

    it('should throw InvalidPropertyValueError for invalid value', () => {
      // Arrange
      const input = {
        name: 'Test Property',
        propertyType: 'PRIMARY_RESIDENCE' as const,
        currentValue: -100000,
      };

      // Act & Assert
      expect(() => service.create(input)).toThrow(InvalidPropertyValueError);
    });

    it('should throw InvalidPropertyValueError for zero value', () => {
      // Arrange
      const input = {
        name: 'Test Property',
        propertyType: 'PRIMARY_RESIDENCE' as const,
        currentValue: 0,
      };

      // Act & Assert
      expect(() => service.create(input)).toThrow(InvalidPropertyValueError);
    });

    it('should generate unique symbols for multiple properties', () => {
      // Arrange
      const input = {
        name: 'Lisbon Apartment',
        propertyType: 'PRIMARY_RESIDENCE' as const,
        currentValue: 450000,
        city: 'Lisbon',
      };

      mockLedgerRepo.listRealEstateAssets.mockReturnValue([
        { symbol: 'PROP-LISBON-001' },
        { symbol: 'PROP-LISBON-002' },
      ]);
      mockLedgerRepo.createAsset.mockImplementation((args: any) => ({
        ...mockPropertyAsset(),
        symbol: args.symbol,
      }));
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 450000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue(null);

      // Act
      const result = service.create(input);

      // Assert - should get next available number (003)
      expect(result.symbol).toBe('PROP-LISBON-003');
    });
  });

  describe('list', () => {
    it('should list all properties with equity calculations', () => {
      // Arrange
      const properties = [
        mockPropertyAsset({ id: 1, symbol: 'PROP-LISBON-001' }),
        mockPropertyAsset({
          id: 2,
          symbol: 'PROP-PORTO-001',
          name: 'Porto House',
          metadata: JSON.stringify({
            propertyType: 'RENTAL',
            city: 'Porto',
          }),
        }),
      ];

      mockLedgerRepo.listRealEstateAssets.mockReturnValue(properties);
      mockRatesRepo.getCachedRate
        .mockReturnValueOnce({ price: 450000 })
        .mockReturnValueOnce({ price: 350000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue(null);

      // Act
      const result = service.list();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].currentValue).toBe(450000);
      expect(result[1].currentValue).toBe(350000);
    });

    it('should return empty array when no properties exist', () => {
      // Arrange
      mockLedgerRepo.listRealEstateAssets.mockReturnValue([]);

      // Act
      const result = service.list();

      // Assert
      expect(result).toEqual([]);
    });

    it('should include mortgage balance and equity calculations', () => {
      // Arrange
      mockLedgerRepo.listRealEstateAssets.mockReturnValue([mockPropertyAsset()]);
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 450000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue({
        id: 1,
        name: 'Test Mortgage',
      });
      mockLedgerRepo.getLatestMortgageBalance.mockReturnValue({
        outstanding_amount: 300000,
      });

      // Act
      const result = service.list();

      // Assert
      expect(result[0].mortgageBalance).toBe(300000);
      expect(result[0].equity).toBe(150000); // 450000 - 300000
      expect(result[0].ltvPercentage).toBeCloseTo(66.67, 1); // 300000 / 450000 * 100
    });
  });

  describe('getById', () => {
    it('should get property by ID', () => {
      // Arrange
      mockLedgerRepo.getAssetById.mockReturnValue(mockPropertyAsset());
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 450000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue(null);

      // Act
      const result = service.getById(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.name).toBe('Lisbon Apartment');
    });

    it('should throw PropertyNotFoundError for non-existent property', () => {
      // Arrange
      mockLedgerRepo.getAssetById.mockReturnValue(null);

      // Act & Assert
      expect(() => service.getById(999)).toThrow(PropertyNotFoundError);
    });

    it('should throw PropertyNotFoundError for non-REAL_ESTATE asset', () => {
      // Arrange
      mockLedgerRepo.getAssetById.mockReturnValue({
        id: 1,
        asset_class: 'CRYPTO',
      });

      // Act & Assert
      expect(() => service.getById(1)).toThrow(PropertyNotFoundError);
    });
  });

  describe('update', () => {
    it('should update property metadata', () => {
      // Arrange
      const existingProperty = mockPropertyAsset();
      mockLedgerRepo.getAssetById.mockReturnValue(existingProperty);
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 450000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue(null);

      // Act
      const result = service.update(1, {
        name: 'Updated Apartment',
        address: '456 New Street',
      });

      // Assert
      expect(mockLedgerRepo.updateAsset).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          name: 'Updated Apartment',
          metadata: expect.stringContaining('456 New Street'),
        })
      );
    });

    it('should throw PropertyNotFoundError for non-existent property', () => {
      // Arrange
      mockLedgerRepo.getAssetById.mockReturnValue(null);

      // Act & Assert
      expect(() => service.update(999, { name: 'Test' })).toThrow(
        PropertyNotFoundError
      );
    });
  });

  describe('updateValue', () => {
    it('should update property valuation', () => {
      // Arrange
      mockLedgerRepo.getAssetById.mockReturnValue(mockPropertyAsset());
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 500000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue(null);

      // Act
      const result = service.updateValue(1, { value: 500000 });

      // Assert
      expect(mockRatesRepo.saveHistoricalRate).toHaveBeenCalledWith({
        asset_symbol: 'PROP-LISBON-001',
        base_currency: 'EUR',
        price: 500000,
        timestamp: expect.any(String),
        source: 'manual',
      });
      expect(mockRatesRepo.updateCachedRate).toHaveBeenCalledWith(
        'PROP-LISBON-001',
        500000,
        'EUR'
      );
      expect(result.currentValue).toBe(500000);
    });

    it('should invalidate snapshot caches for the property', () => {
      // Arrange
      mockLedgerRepo.getAssetById.mockReturnValue(mockPropertyAsset());
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 500000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue(null);

      // Act
      service.updateValue(1, { value: 500000 });

      // Assert
      expect(mockLedgerRepo.invalidateSnapshotCacheForAsset).toHaveBeenCalledWith(1);
    });

    it('should throw InvalidPropertyValueError for invalid value', () => {
      // Arrange
      mockLedgerRepo.getAssetById.mockReturnValue(mockPropertyAsset());

      // Act & Assert
      expect(() => service.updateValue(1, { value: -100 })).toThrow(
        InvalidPropertyValueError
      );
    });

    it('should throw PropertyNotFoundError for non-existent property', () => {
      // Arrange
      mockLedgerRepo.getAssetById.mockReturnValue(null);

      // Act & Assert
      expect(() => service.updateValue(999, { value: 500000 })).toThrow(
        PropertyNotFoundError
      );
    });
  });

  describe('getRealEstateSummary', () => {
    it('should calculate totals for all properties', () => {
      // Arrange
      const properties = [
        mockPropertyAsset({ id: 1, symbol: 'PROP-1' }),
        mockPropertyAsset({ id: 2, symbol: 'PROP-2' }),
      ];

      mockLedgerRepo.listRealEstateAssets.mockReturnValue(properties);
      mockRatesRepo.getCachedRate
        .mockReturnValueOnce({ price: 450000 })
        .mockReturnValueOnce({ price: 350000 });

      // First property: with mortgage
      mockLedgerRepo.getMortgageByLinkedAsset
        .mockReturnValueOnce({ id: 1 })
        .mockReturnValueOnce(null); // Second property: no mortgage

      mockLedgerRepo.getLatestMortgageBalance.mockReturnValue({
        outstanding_amount: 300000,
      });

      // Act
      const result = service.getRealEstateSummary();

      // Assert
      expect(result.totalPropertyValue).toBe(800000); // 450000 + 350000
      expect(result.totalMortgageBalance).toBe(300000); // Only first property has mortgage
      expect(result.totalEquity).toBe(500000); // 800000 - 300000
      expect(result.propertyCount).toBe(2);
      expect(result.properties).toHaveLength(2);
    });

    it('should return zeros when no properties exist', () => {
      // Arrange
      mockLedgerRepo.listRealEstateAssets.mockReturnValue([]);

      // Act
      const result = service.getRealEstateSummary();

      // Assert
      expect(result.totalPropertyValue).toBe(0);
      expect(result.totalMortgageBalance).toBe(0);
      expect(result.totalEquity).toBe(0);
      expect(result.propertyCount).toBe(0);
      expect(result.properties).toEqual([]);
    });

    it('should calculate 100% equity for properties without mortgages', () => {
      // Arrange
      mockLedgerRepo.listRealEstateAssets.mockReturnValue([mockPropertyAsset()]);
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 450000 });
      mockLedgerRepo.getMortgageByLinkedAsset.mockReturnValue(null);

      // Act
      const result = service.getRealEstateSummary();

      // Assert
      expect(result.properties[0].equity).toBe(450000);
      expect(result.properties[0].ltvPercentage).toBeNull();
    });
  });
});
