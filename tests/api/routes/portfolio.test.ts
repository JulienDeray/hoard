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
          {
            asset_id: 1,
            asset_symbol: 'BTC',
            asset_name: 'Bitcoin',
            asset_class: 'CRYPTO',
            amount: 0.5,
            current_value_eur: 22500,
          },
          {
            asset_id: 2,
            asset_symbol: 'ETH',
            asset_name: 'Ethereum',
            asset_class: 'CRYPTO',
            amount: 10,
            current_value_eur: 27500,
          },
        ],
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/portfolio/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.totalAssetsEur).toBe(50000);
      expect(body.data.totalLiabilitiesEur).toBe(0);
      expect(body.data.netWorthEur).toBe(50000);
      expect(body.data.assetCount).toBe(2);
      expect(body.data.snapshotDate).toBe('2024-01-15');
      expect(body.data.holdings).toHaveLength(2);
      // Verify holdings are sorted by allocation descending
      expect(body.data.holdings[0].symbol).toBe('ETH'); // 55% allocation
      expect(body.data.holdings[1].symbol).toBe('BTC'); // 45% allocation
      // Verify holding structure
      expect(body.data.holdings[0]).toMatchObject({
        assetId: 2,
        symbol: 'ETH',
        name: 'Ethereum',
        assetClass: 'CRYPTO',
        amount: 10,
        valueEur: 27500,
        allocationPct: 55,
      });
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
