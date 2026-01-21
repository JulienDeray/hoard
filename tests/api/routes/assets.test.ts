import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, type MockServices } from '../helpers/test-server.js';

describe('Asset Routes', () => {
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

  describe('GET /api/assets', () => {
    it('should return list of assets', async () => {
      services.snapshotService.listAssets.mockReturnValue([
        { id: 1, symbol: 'BTC', name: 'Bitcoin', asset_class: 'CRYPTO' },
        { id: 2, symbol: 'ETH', name: 'Ethereum', asset_class: 'CRYPTO' },
      ]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/assets',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.count).toBe(2);
    });

    it('should handle empty assets list', async () => {
      services.snapshotService.listAssets.mockReturnValue([]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/assets',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
      expect(body.count).toBe(0);
    });
  });

  describe('GET /api/assets/search', () => {
    it('should search assets by query', async () => {
      services.snapshotService.searchAssets.mockReturnValue([
        { id: 1, symbol: 'BTC', name: 'Bitcoin', asset_class: 'CRYPTO' },
      ]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/search?q=btc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].symbol).toBe('BTC');
    });

    it('should use default limit when not provided', async () => {
      services.snapshotService.searchAssets.mockReturnValue([]);

      await server.inject({
        method: 'GET',
        url: '/api/assets/search?q=btc',
      });

      expect(services.snapshotService.searchAssets).toHaveBeenCalledWith('btc', 10);
    });

    it('should pass custom limit to service', async () => {
      services.snapshotService.searchAssets.mockReturnValue([]);

      await server.inject({
        method: 'GET',
        url: '/api/assets/search?q=btc&limit=5',
      });

      expect(services.snapshotService.searchAssets).toHaveBeenCalledWith('btc', 5);
    });

    it('should handle empty query', async () => {
      services.snapshotService.searchAssets.mockReturnValue([]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/assets/search',
      });

      expect(response.statusCode).toBe(200);
      expect(services.snapshotService.searchAssets).toHaveBeenCalledWith('', 10);
    });
  });
});
