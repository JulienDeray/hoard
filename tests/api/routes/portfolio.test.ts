import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, type MockServices } from '../helpers/test-server.js';

describe('Portfolio Routes', () => {
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

  describe('GET /api/portfolio/summary', () => {
    it('should return portfolio summary', async () => {
      services.portfolioService.getPortfolioValue.mockResolvedValue({
        date: '2024-01-15',
        totalValue: 50000,
        currency: 'EUR',
        holdings: [
          { asset_symbol: 'BTC', amount: 0.5, current_value_eur: 22500 },
          { asset_symbol: 'ETH', amount: 10, current_value_eur: 27500 },
        ],
      });
      services.snapshotService.listSnapshots.mockReturnValue({
        snapshots: [],
        totalCount: 5,
        allAssetSymbols: [],
        filteredAssetSymbols: [],
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/portfolio/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.total_value).toBe(50000);
      expect(body.data.currency).toBe('EUR');
      expect(body.data.holdings).toHaveLength(2);
      expect(body.data.snapshot_count).toBe(5);
      expect(body.data.last_update).toBeDefined();
    });

    it('should return null when no portfolio data', async () => {
      services.portfolioService.getPortfolioValue.mockResolvedValue(null);

      const response = await server.inject({
        method: 'GET',
        url: '/api/portfolio/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.message).toBe('No portfolio data found');
    });

    it('should pass date query parameter to service', async () => {
      services.portfolioService.getPortfolioValue.mockResolvedValue(null);

      await server.inject({
        method: 'GET',
        url: '/api/portfolio/summary?date=2024-01-15',
      });

      expect(services.portfolioService.getPortfolioValue).toHaveBeenCalledWith('2024-01-15');
    });
  });
});
