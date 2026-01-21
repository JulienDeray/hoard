/**
 * Portfolio Routes
 *
 * GET /api/portfolio/summary - Get portfolio summary with holdings
 */

import type { FastifyInstance } from 'fastify';
import type { HoldingWithValue } from '../../models/index.js';

interface SummaryQuery {
  date?: string;
}

interface PortfolioHoldingResponse {
  assetId: number;
  symbol: string;
  name: string;
  assetClass: string;
  amount: number;
  valueEur: number;
  allocationPct: number;
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

      const totalAssetsEur = portfolio.totalValue;
      const totalLiabilitiesEur = 0; // v3 scope - hardcoded for now

      // Transform holdings to new format with allocation percentage
      const holdingsWithAllocation: PortfolioHoldingResponse[] = portfolio.holdings.map(
        (holding: HoldingWithValue) => {
          const valueEur = holding.current_value_eur || holding.value_eur || 0;
          const allocationPct = totalAssetsEur > 0
            ? Math.round((valueEur / totalAssetsEur) * 1000) / 10 // 1 decimal place
            : 0;

          return {
            assetId: holding.asset_id,
            symbol: holding.asset_symbol,
            name: holding.asset_name,
            assetClass: holding.asset_class || 'CRYPTO',
            amount: holding.amount,
            valueEur,
            allocationPct,
          };
        }
      );

      // Sort by allocation descending
      holdingsWithAllocation.sort((a, b) => b.allocationPct - a.allocationPct);

      return {
        data: {
          date: portfolio.date,
          totalAssetsEur,
          totalLiabilitiesEur,
          netWorthEur: totalAssetsEur - totalLiabilitiesEur,
          holdings: holdingsWithAllocation,
          assetCount: holdingsWithAllocation.length,
          snapshotDate: portfolio.date,
        },
      };
    }
  );
}
