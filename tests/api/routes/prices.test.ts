import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, type MockServices } from '../helpers/test-server.js';

describe('Price Routes', () => {
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

  describe('GET /api/prices/current', () => {
    it('should return current prices for symbols', async () => {
      services.portfolioService.getCurrentPrices.mockResolvedValue([
        { symbol: 'BTC', price: 45000, currency: 'EUR', fromCache: true, timestamp: '2024-01-15T00:00:00Z' },
        { symbol: 'ETH', price: 2750, currency: 'EUR', fromCache: false, timestamp: '2024-01-15T00:00:00Z' },
      ]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/prices/current?symbols=BTC,ETH',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.count).toBe(2);
    });

    it('should return empty array when no symbols provided', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/prices/current',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
      expect(body.count).toBe(0);
    });

    it('should parse symbols correctly', async () => {
      services.portfolioService.getCurrentPrices.mockResolvedValue([]);

      await server.inject({
        method: 'GET',
        url: '/api/prices/current?symbols=btc,eth,sol',
      });

      expect(services.portfolioService.getCurrentPrices).toHaveBeenCalledWith(['BTC', 'ETH', 'SOL']);
    });
  });

  describe('POST /api/prices/refresh', () => {
    it('should refresh prices for symbols', async () => {
      services.portfolioService.refreshPrices.mockResolvedValue([
        { symbol: 'BTC', price: 46000, currency: 'EUR', fromCache: false, timestamp: '2024-01-15T00:00:00Z' },
      ]);

      const response = await server.inject({
        method: 'POST',
        url: '/api/prices/refresh',
        payload: { symbols: ['BTC'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].fromCache).toBe(false);
    });

    it('should return empty array when no symbols provided', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/prices/refresh',
        payload: { symbols: [] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
    });

    it('should handle price fetch errors gracefully', async () => {
      services.portfolioService.refreshPrices.mockResolvedValue([
        { symbol: 'INVALID', currency: 'EUR', fromCache: false, timestamp: '2024-01-15T00:00:00Z', error: 'Not found' },
      ]);

      const response = await server.inject({
        method: 'POST',
        url: '/api/prices/refresh',
        payload: { symbols: ['INVALID'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data[0].error).toBe('Not found');
    });
  });
});
