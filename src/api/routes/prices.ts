/**
 * Price Routes
 *
 * GET /api/prices/current - Get current prices for symbols
 * POST /api/prices/refresh - Force refresh prices from CMC
 */

import type { FastifyInstance } from 'fastify';

interface CurrentPricesQuery {
  symbols?: string;
}

interface RefreshPricesBody {
  symbols: string[];
}

export async function priceRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/prices/current - Get current prices for symbols
   * Query: ?symbols=BTC,ETH,SOL (comma-separated)
   */
  fastify.get<{ Querystring: CurrentPricesQuery }>(
    '/current',
    async (request) => {
      const { symbols } = request.query;

      if (!symbols) {
        return {
          data: [],
          count: 0,
        };
      }

      const symbolList = symbols.split(',').map((s) => s.trim().toUpperCase());
      const prices = await fastify.services.portfolioService.getCurrentPrices(symbolList);

      return {
        data: prices,
        count: prices.length,
      };
    }
  );

  /**
   * POST /api/prices/refresh - Force refresh prices from CoinMarketCap
   */
  fastify.post<{ Body: RefreshPricesBody }>(
    '/refresh',
    async (request) => {
      const { symbols } = request.body;

      if (!symbols || symbols.length === 0) {
        return {
          data: [],
          count: 0,
        };
      }

      const prices = await fastify.services.portfolioService.refreshPrices(symbols);

      return {
        data: prices,
        count: prices.length,
      };
    }
  );
}
