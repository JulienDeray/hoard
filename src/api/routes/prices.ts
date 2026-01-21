/**
 * Price Routes
 *
 * GET /api/prices/current - Get current prices for symbols
 * POST /api/prices/refresh - Force refresh prices from CMC
 * POST /api/prices/override - Set manual price override for an asset
 */

import type { FastifyInstance } from 'fastify';

interface CurrentPricesQuery {
  symbols?: string;
}

interface RefreshPricesBody {
  symbols: string[];
}

interface PriceOverrideBody {
  symbol: string;
  date: string;
  price: number;
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

  /**
   * POST /api/prices/override - Set manual price override for an asset
   * Saves to historical_rates with source='manual'
   */
  fastify.post<{ Body: PriceOverrideBody }>(
    '/override',
    async (request, reply) => {
      const { symbol, date, price } = request.body;

      if (!symbol || !date || price === undefined || price === null) {
        reply.status(400);
        return {
          error: 'Missing required fields: symbol, date, price',
        };
      }

      if (price < 0) {
        reply.status(400);
        return {
          error: 'Price must be non-negative',
        };
      }

      // Create timestamp from date at noon UTC
      const timestamp = `${date}T12:00:00.000Z`;

      const rate = fastify.services.ratesRepo.saveHistoricalRate({
        asset_symbol: symbol.toUpperCase(),
        base_currency: 'EUR',
        price,
        timestamp,
        source: 'manual',
      });

      reply.status(201);
      return {
        data: rate,
      };
    }
  );
}
