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

interface AssetClassAllocationResponse {
  assetClass: string;
  displayName: string;
  valueEur: number;
  allocationPct: number;
}

function formatAssetClassName(assetClass: string): string {
  const names: Record<string, string> = {
    CRYPTO: 'Crypto',
    FIAT: 'Cash',
    STOCK: 'Stocks',
    REAL_ESTATE: 'Real Estate',
    COMMODITY: 'Commodities',
    OTHER: 'Other',
  };
  return names[assetClass] || assetClass;
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

      // Calculate actual liabilities from liability_balances (all in EUR)
      let totalLiabilitiesEur = 0;
      if (portfolio.snapshotId) {
        const liabilityBalances = fastify.services.ledgerRepo.getLiabilityBalancesBySnapshotId(
          portfolio.snapshotId
        );
        totalLiabilitiesEur = liabilityBalances.reduce(
          (sum, lb) => sum + (lb.outstanding_amount || 0),
          0
        );
      }

      // Transform holdings to new format with allocation percentage
      const holdingsWithAllocation: PortfolioHoldingResponse[] = portfolio.holdings.map(
        (holding: HoldingWithValue) => {
          const valueEur = holding.current_value_eur || 0;
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

      // Get real estate summary
      const realEstateSummary = fastify.services.propertyService.getRealEstateSummary();

      // Calculate asset class allocation
      // Group holdings by asset class
      const assetClassTotals = new Map<string, number>();
      for (const holding of holdingsWithAllocation) {
        const current = assetClassTotals.get(holding.assetClass) || 0;
        assetClassTotals.set(holding.assetClass, current + holding.valueEur);
      }

      // Add real estate equity as REAL_ESTATE class
      const realEstateEquity = realEstateSummary.totalEquity;
      if (realEstateEquity > 0) {
        assetClassTotals.set('REAL_ESTATE', realEstateEquity);
      }

      // Calculate total including real estate equity
      const totalWithRealEstate = totalAssetsEur + realEstateEquity;

      // Build asset class allocation array
      const assetClassAllocation: AssetClassAllocationResponse[] = Array.from(
        assetClassTotals.entries()
      )
        .map(([assetClass, valueEur]) => ({
          assetClass,
          displayName: formatAssetClassName(assetClass),
          valueEur,
          allocationPct:
            totalWithRealEstate > 0
              ? Math.round((valueEur / totalWithRealEstate) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.allocationPct - a.allocationPct);

      return {
        data: {
          date: portfolio.date,
          totalAssetsEur: totalWithRealEstate,
          totalLiabilitiesEur,
          netWorthEur: totalWithRealEstate - totalLiabilitiesEur,
          holdings: holdingsWithAllocation,
          assetCount: holdingsWithAllocation.length,
          snapshotDate: portfolio.date,
          assetClassAllocation,
          realEstateSummary: {
            totalPropertyValue: realEstateSummary.totalPropertyValue,
            totalMortgageBalance: realEstateSummary.totalMortgageBalance,
            totalEquity: realEstateSummary.totalEquity,
            propertyCount: realEstateSummary.propertyCount,
            properties: realEstateSummary.properties.map((p) => ({
              id: p.id,
              symbol: p.symbol,
              name: p.name,
              propertyType: p.metadata.propertyType,
              currentValue: p.currentValue,
              mortgageBalance: p.mortgageBalance,
              equity: p.equity,
              ltvPercentage: p.ltvPercentage,
            })),
          },
        },
      };
    }
  );
}
