/**
 * Portfolio Routes
 *
 * GET /api/portfolio/summary - Get portfolio summary with holdings
 */

import type { FastifyInstance } from 'fastify';

interface SummaryQuery {
  date?: string;
}

export async function portfolioRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/portfolio/summary - Get portfolio summary with current values
   */
  fastify.get<{ Querystring: SummaryQuery }>(
    '/summary',
    async (request) => {
      const { date } = request.query;
      const portfolio = await fastify.services.portfolioService.getPortfolioValue(date);

      if (!portfolio) {
        return {
          data: null,
          message: 'No portfolio data found',
        };
      }

      // Get snapshot count for UI
      const { totalCount: snapshotCount } = fastify.services.snapshotService.listSnapshots();

      return {
        data: {
          date: portfolio.date,
          total_value: portfolio.totalValue,
          currency: portfolio.currency,
          holdings: portfolio.holdings,
          snapshot_count: snapshotCount,
          last_update: new Date().toISOString(),
        },
      };
    }
  );
}
