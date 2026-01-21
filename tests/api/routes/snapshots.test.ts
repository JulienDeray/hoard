import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, type MockServices } from '../helpers/test-server.js';
import { SnapshotNotFoundError, SnapshotAlreadyExistsError } from '../../../src/errors/index.js';

describe('Snapshot Routes', () => {
  let server: FastifyInstance;
  let services: MockServices;

  beforeEach(async () => {
    const result = await createTestServer();
    server = result.server;
    services = result.services;
  });

  afterEach(async () => {
    await server.close();
  });

  describe('GET /api/snapshots', () => {
    it('should return list of snapshots', async () => {
      services.snapshotService.listSnapshots.mockReturnValue({
        snapshots: [
          {
            snapshot: { id: 1, date: '2024-01-15', notes: 'Test' },
            holdingsMap: new Map([['BTC', 0.5]]),
          },
        ],
        totalCount: 1,
        allAssetSymbols: ['BTC'],
        filteredAssetSymbols: ['BTC'],
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/snapshots',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].date).toBe('2024-01-15');
      expect(body.count).toBe(1);
    });

    it('should handle empty snapshots list', async () => {
      services.snapshotService.listSnapshots.mockReturnValue({
        snapshots: [],
        totalCount: 0,
        allAssetSymbols: [],
        filteredAssetSymbols: [],
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/snapshots',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
      expect(body.count).toBe(0);
    });

    it('should pass query parameters to service', async () => {
      services.snapshotService.listSnapshots.mockReturnValue({
        snapshots: [],
        totalCount: 0,
        allAssetSymbols: [],
        filteredAssetSymbols: [],
      });

      await server.inject({
        method: 'GET',
        url: '/api/snapshots?assets=BTC,ETH&last=5',
      });

      expect(services.snapshotService.listSnapshots).toHaveBeenCalledWith({
        assets: 'BTC,ETH',
        last: 5,
      });
    });
  });

  describe('GET /api/snapshots/:date', () => {
    it('should return snapshot by date', async () => {
      services.snapshotService.getSnapshotByDate.mockReturnValue({
        snapshot: { id: 1, date: '2024-01-15', notes: 'Test' },
        holdings: [{ asset_symbol: 'BTC', amount: 0.5 }],
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/snapshots/2024-01-15',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.snapshot.date).toBe('2024-01-15');
      expect(body.data.holdings).toHaveLength(1);
    });

    it('should return 404 for non-existent snapshot', async () => {
      services.snapshotService.getSnapshotByDate.mockImplementation(() => {
        throw new SnapshotNotFoundError('2024-01-01');
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/snapshots/2024-01-01',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('SNAPSHOT_NOT_FOUND');
    });
  });

  describe('POST /api/snapshots', () => {
    it('should create a new snapshot', async () => {
      services.snapshotService.createSnapshot.mockReturnValue({
        id: 1,
        date: '2024-01-15',
        notes: 'New snapshot',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/snapshots',
        payload: { date: '2024-01-15', notes: 'New snapshot' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.date).toBe('2024-01-15');
    });

    it('should return 409 if snapshot already exists', async () => {
      services.snapshotService.createSnapshot.mockImplementation(() => {
        throw new SnapshotAlreadyExistsError('2024-01-15', 5);
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/snapshots',
        payload: { date: '2024-01-15' },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('SNAPSHOT_ALREADY_EXISTS');
    });
  });

  describe('DELETE /api/snapshots/:date', () => {
    it('should delete snapshot by date', async () => {
      services.snapshotService.deleteSnapshot.mockReturnValue({
        snapshot: { id: 1, date: '2024-01-15' },
        deletedHoldingsCount: 5,
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/snapshots/2024-01-15',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.deletedHoldingsCount).toBe(5);
    });

    it('should return 404 for non-existent snapshot', async () => {
      services.snapshotService.deleteSnapshot.mockImplementation(() => {
        throw new SnapshotNotFoundError('2024-01-01');
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/snapshots/2024-01-01',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/snapshots/:date/holdings', () => {
    it('should add holding to snapshot', async () => {
      services.snapshotService.getOrCreateSnapshot.mockReturnValue({
        snapshot: { id: 1, date: '2024-01-15' },
        isNew: false,
      });
      services.snapshotService.addHolding.mockReturnValue({
        holding: { id: 1, asset_id: 1, amount: 0.5 },
        isUpdate: false,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/snapshots/2024-01-15/holdings',
        payload: { assetId: 1, amount: 0.5 },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.holding.amount).toBe(0.5);
      expect(body.data.isUpdate).toBe(false);
    });

    it('should return 200 if holding is updated', async () => {
      services.snapshotService.getOrCreateSnapshot.mockReturnValue({
        snapshot: { id: 1, date: '2024-01-15' },
        isNew: false,
      });
      services.snapshotService.addHolding.mockReturnValue({
        holding: { id: 1, asset_id: 1, amount: 1.0 },
        isUpdate: true,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/snapshots/2024-01-15/holdings',
        payload: { assetId: 1, amount: 1.0 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.isUpdate).toBe(true);
    });
  });
});
