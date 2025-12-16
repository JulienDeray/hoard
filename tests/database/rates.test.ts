import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { RatesRepository } from '../../src/database/rates.js';
import { setupTestRatesDb } from '../helpers/database-setup.js';

describe('RatesRepository', () => {
  let db: Database.Database;
  let repository: RatesRepository;

  beforeEach(() => {
    db = setupTestRatesDb();
    repository = new RatesRepository(db, 5); // 5-minute TTL
  });

  afterEach(() => {
    db.close();
  });

  describe('Historical Rates Operations', () => {
    describe('saveHistoricalRate', () => {
      it('should save a new historical rate', () => {
        // Arrange
        const input = {
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 45000,
          timestamp: '2024-01-15T12:00:00Z',
        };

        // Act
        const result = repository.saveHistoricalRate(input);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBeTypeOf('number');
        expect(result.asset_symbol).toBe('BTC');
        expect(result.price).toBe(45000);
      });

      it('should save with optional fields', () => {
        // Arrange
        const input = {
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 45000,
          timestamp: '2024-01-15T12:00:00Z',
          volume_24h: 1000000,
          market_cap: 900000000000,
          source: 'coinmarketcap',
        };

        // Act
        const result = repository.saveHistoricalRate(input);

        // Assert
        expect(result.volume_24h).toBe(1000000);
        expect(result.market_cap).toBe(900000000000);
        expect(result.source).toBe('coinmarketcap');
      });

      it('should replace existing rate with same symbol/currency/timestamp', () => {
        // Arrange
        const input = {
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 45000,
          timestamp: '2024-01-15T12:00:00Z',
        };

        repository.saveHistoricalRate(input);

        // Act - Save again with different price
        const updated = repository.saveHistoricalRate({
          ...input,
          price: 46000,
        });

        // Assert
        expect(updated.price).toBe(46000);
      });
    });

    describe('getHistoricalRateById', () => {
      it('should retrieve existing rate', () => {
        // Arrange
        const saved = repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 45000,
          timestamp: '2024-01-15T12:00:00Z',
        });

        // Act
        const result = repository.getHistoricalRateById(saved.id);

        // Assert
        expect(result).toEqual(saved);
      });

      it('should return undefined for non-existent rate', () => {
        // Act
        const result = repository.getHistoricalRateById(99999);

        // Assert
        expect(result).toBeUndefined();
      });
    });

    describe('getHistoricalRate', () => {
      it('should retrieve exact date match', () => {
        // Arrange
        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 45000,
          timestamp: '2024-01-15T12:00:00Z',
        });

        // Act
        const result = repository.getHistoricalRate('BTC', '2024-01-15');

        // Assert
        expect(result?.price).toBe(45000);
      });

      it('should retrieve closest previous rate when no exact match', () => {
        // Arrange
        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 44000,
          timestamp: '2024-01-14T12:00:00Z',
        });

        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 46000,
          timestamp: '2024-01-16T12:00:00Z',
        });

        // Act - Query for date between two saved rates
        const result = repository.getHistoricalRate('BTC', '2024-01-15');

        // Assert - Should get the earlier rate (Jan 14)
        expect(result?.price).toBe(44000);
      });

      it('should return undefined when no rate available', () => {
        // Act
        const result = repository.getHistoricalRate('BTC', '2024-01-15');

        // Assert
        expect(result).toBeUndefined();
      });

      it('should return most recent rate when multiple rates exist for same date', () => {
        // Arrange
        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 45000,
          timestamp: '2024-01-15T09:00:00Z',
        });

        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 46000,
          timestamp: '2024-01-15T15:00:00Z',
        });

        // Act
        const result = repository.getHistoricalRate('BTC', '2024-01-15');

        // Assert - Should get the later rate
        expect(result?.price).toBe(46000);
      });
    });

    describe('getHistoricalRatesForAsset', () => {
      it('should retrieve all rates for an asset', () => {
        // Arrange
        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 45000,
          timestamp: '2024-01-15T12:00:00Z',
        });

        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 46000,
          timestamp: '2024-01-16T12:00:00Z',
        });

        // Act
        const results = repository.getHistoricalRatesForAsset('BTC');

        // Assert
        expect(results).toHaveLength(2);
        expect(results[0].price).toBe(46000); // Most recent first
      });

      it('should respect limit parameter', () => {
        // Arrange
        for (let i = 0; i < 5; i++) {
          repository.saveHistoricalRate({
            asset_symbol: 'BTC',
            base_currency: 'EUR',
            price: 45000 + i,
            timestamp: `2024-01-${10 + i}T12:00:00Z`,
          });
        }

        // Act
        const results = repository.getHistoricalRatesForAsset('BTC', 'EUR', 3);

        // Assert
        expect(results).toHaveLength(3);
      });
    });

    describe('getHistoricalRatesRange', () => {
      it('should retrieve rates within date range', () => {
        // Arrange
        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 44000,
          timestamp: '2024-01-14T12:00:00Z',
        });

        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 45000,
          timestamp: '2024-01-15T12:00:00Z',
        });

        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 46000,
          timestamp: '2024-01-16T12:00:00Z',
        });

        // Act
        const results = repository.getHistoricalRatesRange(
          'BTC',
          '2024-01-14',
          '2024-01-15'
        );

        // Assert
        expect(results).toHaveLength(2);
        expect(results[0].price).toBe(44000); // ASC order
        expect(results[1].price).toBe(45000);
      });
    });
  });

  describe('Rate Cache Operations', () => {
    describe('getCachedRate', () => {
      it('should retrieve valid cached rate', () => {
        // Arrange
        repository.updateCachedRate('BTC', 45000);

        // Act
        const result = repository.getCachedRate('BTC');

        // Assert
        expect(result?.price).toBe(45000);
      });

      it('should return undefined for non-existent cache', () => {
        // Act
        const result = repository.getCachedRate('BTC');

        // Assert
        expect(result).toBeUndefined();
      });

      it('should return undefined and delete expired cache', () => {
        // Arrange - Create repository with 0-minute TTL
        const shortTTLRepo = new RatesRepository(db, 0);
        shortTTLRepo.updateCachedRate('BTC', 45000);

        // Wait a moment to ensure cache is expired
        const wait = (ms: number) =>
          new Promise((resolve) => setTimeout(resolve, ms));

        // Act & Assert
        return wait(100).then(() => {
          const result = shortTTLRepo.getCachedRate('BTC');
          expect(result).toBeUndefined();

          // Verify cache was deleted
          const directQuery = db
            .prepare(
              'SELECT * FROM rate_cache WHERE asset_symbol = ? AND base_currency = ?'
            )
            .get('BTC', 'EUR');
          expect(directQuery).toBeUndefined();
        });
      });
    });

    describe('updateCachedRate', () => {
      it('should create new cache entry', () => {
        // Act
        repository.updateCachedRate('BTC', 45000);
        const result = repository.getCachedRate('BTC');

        // Assert
        expect(result?.price).toBe(45000);
      });

      it('should update existing cache entry', () => {
        // Arrange
        repository.updateCachedRate('BTC', 45000);

        // Act
        repository.updateCachedRate('BTC', 46000);
        const result = repository.getCachedRate('BTC');

        // Assert
        expect(result?.price).toBe(46000);
      });

      it('should also save to historical rates', () => {
        // Act
        repository.updateCachedRate('BTC', 45000);

        // Assert
        const historical = repository.getHistoricalRatesForAsset('BTC');
        expect(historical.length).toBeGreaterThan(0);
        expect(historical[0].price).toBe(45000);
      });
    });

    describe('deleteCachedRate', () => {
      it('should delete existing cache entry', () => {
        // Arrange
        repository.updateCachedRate('BTC', 45000);

        // Act
        repository.deleteCachedRate('BTC');
        const result = repository.getCachedRate('BTC');

        // Assert
        expect(result).toBeUndefined();
      });
    });

    describe('clearCache', () => {
      it('should delete all cache entries', () => {
        // Arrange
        repository.updateCachedRate('BTC', 45000);
        repository.updateCachedRate('ETH', 2750);

        // Act
        repository.clearCache();

        // Assert
        expect(repository.getCachedRate('BTC')).toBeUndefined();
        expect(repository.getCachedRate('ETH')).toBeUndefined();
      });
    });
  });

  describe('Utility Methods', () => {
    describe('getOrFetchRate', () => {
      it('should return cached rate when no date specified', () => {
        // Arrange
        repository.updateCachedRate('BTC', 45000);

        // Act
        const result = repository.getOrFetchRate('BTC', null);

        // Assert
        expect(result).toBe(45000);
      });

      it('should return historical rate when date specified', () => {
        // Arrange
        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 42000,
          timestamp: '2024-01-15T12:00:00Z',
        });

        // Act
        const result = repository.getOrFetchRate('BTC', '2024-01-15');

        // Assert
        expect(result).toBe(42000);
      });

      it('should return undefined when rate not available', () => {
        // Act
        const result = repository.getOrFetchRate('BTC', null);

        // Assert
        expect(result).toBeUndefined();
      });
    });

    describe('hasRateForDate', () => {
      it('should return true when rate exists for date', () => {
        // Arrange
        repository.saveHistoricalRate({
          asset_symbol: 'BTC',
          base_currency: 'EUR',
          price: 45000,
          timestamp: '2024-01-15T12:00:00Z',
        });

        // Act
        const result = repository.hasRateForDate('BTC', '2024-01-15');

        // Assert
        expect(result).toBe(true);
      });

      it('should return false when rate does not exist', () => {
        // Act
        const result = repository.hasRateForDate('BTC', '2024-01-15');

        // Assert
        expect(result).toBe(false);
      });
    });
  });
});
