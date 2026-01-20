import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { LedgerRepository } from '../../src/database/ledger.js';
import { setupTestLedgerDb } from '../helpers/database-setup.js';

describe('LedgerRepository', () => {
  let db: Database.Database;
  let repository: LedgerRepository;

  beforeEach(() => {
    db = setupTestLedgerDb();
    repository = new LedgerRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Snapshot Operations', () => {
    describe('createSnapshot', () => {
      it('should create a new snapshot with notes', () => {
        // Arrange
        const input = {
          date: '2024-01-15',
          notes: 'January snapshot',
        };

        // Act
        const result = repository.createSnapshot(input);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBeTypeOf('number');
        expect(result.date).toBe(input.date);
        expect(result.notes).toBe(input.notes);
      });

      it('should create a snapshot without notes', () => {
        // Arrange
        const input = {
          date: '2024-02-15',
          notes: undefined,
        };

        // Act
        const result = repository.createSnapshot(input);

        // Assert
        expect(result).toBeDefined();
        expect(result.date).toBe(input.date);
        expect(result.notes).toBeNull();
      });

      it('should throw on duplicate date constraint violation', () => {
        // Arrange
        const input = { date: '2024-01-15', notes: 'First' };
        repository.createSnapshot(input);

        // Act & Assert
        expect(() => repository.createSnapshot(input)).toThrow();
      });
    });

    describe('getSnapshotById', () => {
      it('should retrieve existing snapshot', () => {
        // Arrange
        const created = repository.createSnapshot({
          date: '2024-01-15',
          notes: 'Test',
        });

        // Act
        const result = repository.getSnapshotById(created.id);

        // Assert
        expect(result).toEqual(created);
      });

      it('should return undefined for non-existent snapshot', () => {
        // Act
        const result = repository.getSnapshotById(99999);

        // Assert
        expect(result).toBeUndefined();
      });
    });

    describe('getSnapshotByDate', () => {
      it('should retrieve snapshot by date', () => {
        // Arrange
        const created = repository.createSnapshot({
          date: '2024-01-15',
          notes: 'Test',
        });

        // Act
        const result = repository.getSnapshotByDate('2024-01-15');

        // Assert
        expect(result).toEqual(created);
      });

      it('should return undefined for non-existent date', () => {
        // Act
        const result = repository.getSnapshotByDate('2099-12-31');

        // Assert
        expect(result).toBeUndefined();
      });
    });

    describe('getLatestSnapshot', () => {
      it('should return most recent snapshot', () => {
        // Arrange
        repository.createSnapshot({ date: '2024-01-15', notes: 'Jan' });
        const latest = repository.createSnapshot({
          date: '2024-02-15',
          notes: 'Feb',
        });

        // Act
        const result = repository.getLatestSnapshot();

        // Assert
        expect(result).toEqual(latest);
      });

      it('should return undefined when no snapshots', () => {
        // Act
        const result = repository.getLatestSnapshot();

        // Assert
        expect(result).toBeUndefined();
      });
    });

    describe('listSnapshots', () => {
      it('should return all snapshots in descending date order', () => {
        // Arrange
        const jan = repository.createSnapshot({
          date: '2024-01-15',
          notes: 'Jan',
        });
        const feb = repository.createSnapshot({
          date: '2024-02-15',
          notes: 'Feb',
        });

        // Act
        const results = repository.listSnapshots();

        // Assert
        expect(results).toHaveLength(2);
        expect(results[0].id).toBe(feb.id);
        expect(results[1].id).toBe(jan.id);
      });

      it('should return empty array when no snapshots', () => {
        // Act
        const results = repository.listSnapshots();

        // Assert
        expect(results).toEqual([]);
      });
    });

    describe('deleteSnapshot', () => {
      it('should delete existing snapshot', () => {
        // Arrange
        const created = repository.createSnapshot({
          date: '2024-01-15',
          notes: 'Test',
        });

        // Act
        repository.deleteSnapshot(created.id);
        const result = repository.getSnapshotById(created.id);

        // Assert
        expect(result).toBeUndefined();
      });
    });
  });

  describe('Holding Operations', () => {
    let snapshotId: number;
    let btcAssetId: number;
    let ethAssetId: number;

    beforeEach(() => {
      const snapshot = repository.createSnapshot({
        date: '2024-01-15',
        notes: 'Test snapshot',
      });
      snapshotId = snapshot.id;

      // Create test assets using v3 schema
      const btcAsset = repository.createAsset({
        symbol: 'BTC',
        name: 'Bitcoin',
        asset_class: 'CRYPTO',
        valuation_source: 'CMC',
        external_id: '1',
      });
      btcAssetId = btcAsset.id;

      const ethAsset = repository.createAsset({
        symbol: 'ETH',
        name: 'Ethereum',
        asset_class: 'CRYPTO',
        valuation_source: 'CMC',
        external_id: '1027',
      });
      ethAssetId = ethAsset.id;
    });

    describe('createHolding', () => {
      it('should create a new holding', () => {
        // Arrange
        const input = {
          snapshot_id: snapshotId,
          asset_id: btcAssetId,
          amount: 0.5,
        };

        // Act
        const result = repository.createHolding(input);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBeTypeOf('number');
        expect(result.snapshot_id).toBe(snapshotId);
        expect(result.asset_id).toBe(btcAssetId);
        expect(result.amount).toBe(0.5);
      });

      it('should create holding with all optional fields', () => {
        // Arrange
        const input = {
          snapshot_id: snapshotId,
          asset_id: ethAssetId,
          amount: 10,
          value_eur: 25000,
          notes: 'Bought at discount',
        };

        // Act
        const result = repository.createHolding(input);

        // Assert
        expect(result.value_eur).toBe(input.value_eur);
        expect(result.notes).toBe(input.notes);
      });
    });

    describe('getHoldingById', () => {
      it('should retrieve existing holding', () => {
        // Arrange
        const created = repository.createHolding({
          snapshot_id: snapshotId,
          asset_id: btcAssetId,
          amount: 0.5,
        });

        // Act
        const result = repository.getHoldingById(created.id);

        // Assert
        expect(result).toEqual(created);
      });

      it('should return undefined for non-existent holding', () => {
        // Act
        const result = repository.getHoldingById(99999);

        // Assert
        expect(result).toBeUndefined();
      });
    });

    describe('getHoldingsBySnapshotId', () => {
      it('should retrieve all holdings for a snapshot', () => {
        // Arrange
        repository.createHolding({
          snapshot_id: snapshotId,
          asset_id: btcAssetId,
          amount: 0.5,
        });
        repository.createHolding({
          snapshot_id: snapshotId,
          asset_id: ethAssetId,
          amount: 10,
        });

        // Act
        const results = repository.getHoldingsBySnapshotId(snapshotId);

        // Assert
        expect(results).toHaveLength(2);
      });

      it('should return empty array for snapshot with no holdings', () => {
        // Act
        const results = repository.getHoldingsBySnapshotId(snapshotId);

        // Assert
        expect(results).toEqual([]);
      });
    });

    describe('getHoldingsByDate', () => {
      it('should retrieve holdings for a specific date', () => {
        // Arrange
        repository.createHolding({
          snapshot_id: snapshotId,
          asset_id: btcAssetId,
          amount: 0.5,
        });

        // Act
        const results = repository.getHoldingsByDate('2024-01-15');

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0].asset_symbol).toBe('BTC');
      });
    });

    describe('getLatestHoldings', () => {
      it('should return holdings from latest snapshot', () => {
        // Arrange - Create earlier snapshot with holdings
        repository.createHolding({
          snapshot_id: snapshotId,
          asset_id: btcAssetId,
          amount: 0.5,
        });

        // Create newer snapshot with different holdings
        const newSnapshot = repository.createSnapshot({
          date: '2024-02-15',
          notes: 'Feb',
        });
        repository.createHolding({
          snapshot_id: newSnapshot.id,
          asset_id: ethAssetId,
          amount: 10,
        });

        // Act
        const results = repository.getLatestHoldings();

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0].asset_symbol).toBe('ETH'); // Latest snapshot
      });

      it('should return empty array when no snapshots', () => {
        // Arrange - Delete the test snapshot
        repository.deleteSnapshot(snapshotId);

        // Act
        const results = repository.getLatestHoldings();

        // Assert
        expect(results).toEqual([]);
      });
    });

    describe('updateHolding', () => {
      it('should update holding fields', () => {
        // Arrange
        const created = repository.createHolding({
          snapshot_id: snapshotId,
          asset_id: btcAssetId,
          amount: 0.5,
        });

        // Act
        repository.updateHolding(created.id, {
          amount: 1.0,
          notes: 'Updated amount',
        });
        const result = repository.getHoldingById(created.id);

        // Assert
        expect(result?.amount).toBe(1.0);
        expect(result?.notes).toBe('Updated amount');
      });
    });

    describe('deleteHolding', () => {
      it('should delete existing holding', () => {
        // Arrange
        const created = repository.createHolding({
          snapshot_id: snapshotId,
          asset_id: btcAssetId,
          amount: 0.5,
        });

        // Act
        repository.deleteHolding(created.id);
        const result = repository.getHoldingById(created.id);

        // Assert
        expect(result).toBeUndefined();
      });
    });
  });

  describe('Asset Operations', () => {
    describe('createAsset', () => {
      it('should create a new asset', () => {
        // Arrange
        const input = {
          symbol: 'BTC',
          name: 'Bitcoin',
          asset_class: 'CRYPTO' as const,
          valuation_source: 'CMC' as const,
          external_id: '1',
        };

        // Act
        const result = repository.createAsset(input);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBeTypeOf('number');
        expect(result.symbol).toBe('BTC');
        expect(result.name).toBe('Bitcoin');
        expect(result.asset_class).toBe('CRYPTO');
        expect(result.external_id).toBe('1');
        expect(result.is_active).toBe(true);
      });

      it('should throw on duplicate symbol constraint violation', () => {
        // Arrange
        const input = {
          symbol: 'BTC',
          name: 'Bitcoin',
        };
        repository.createAsset(input);

        // Act & Assert
        expect(() => repository.createAsset(input)).toThrow();
      });
    });

    describe('getAssetBySymbol', () => {
      it('should retrieve existing asset', () => {
        // Arrange
        const created = repository.createAsset({
          symbol: 'BTC',
          name: 'Bitcoin',
          external_id: '1',
        });

        // Act
        const result = repository.getAssetBySymbol('BTC');

        // Assert
        expect(result?.symbol).toBe(created.symbol);
        expect(result?.name).toBe(created.name);
      });

      it('should return undefined for non-existent asset', () => {
        // Act
        const result = repository.getAssetBySymbol('NONEXISTENT');

        // Assert
        expect(result).toBeUndefined();
      });
    });

    describe('listAssets', () => {
      it('should return all assets', () => {
        // Arrange
        repository.createAsset({ symbol: 'BTC', name: 'Bitcoin', external_id: '1' });
        repository.createAsset({ symbol: 'ETH', name: 'Ethereum', external_id: '1027' });

        // Act
        const results = repository.listAssets();

        // Assert
        expect(results).toHaveLength(2);
      });

      it('should return empty array when no assets', () => {
        // Act
        const results = repository.listAssets();

        // Assert
        expect(results).toEqual([]);
      });
    });
  });
});
