/**
 * Snapshot Routes
 *
 * GET /api/snapshots - List all snapshots
 * GET /api/snapshots/:date - Get snapshot by date
 * POST /api/snapshots - Create a new snapshot
 * DELETE /api/snapshots/:date - Delete a snapshot
 * POST /api/snapshots/:date/holdings - Add a holding to a snapshot
 * PUT /api/snapshots/:date/holdings/:assetId - Update a holding
 * DELETE /api/snapshots/:date/holdings/:assetId - Delete a holding
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

// Query/Param types
interface DateParams {
  date: string;
}

interface HoldingParams extends DateParams {
  assetId: string;
}

interface ListSnapshotsQuery {
  assets?: string;
  last?: string;
}

interface CreateSnapshotBody {
  date: string;
  notes?: string;
}

interface AddHoldingBody {
  assetId: number;
  amount: number;
  priceOverride?: number;
}

interface UpdateHoldingBody {
  amount?: number;
  notes?: string;
}

interface LiabilityBalanceParams extends DateParams {
  liabilityId: string;
}

interface AddLiabilityBalanceBody {
  liabilityId: number;
  outstandingAmount: number;
}

interface UpdateLiabilityBalanceBody {
  outstandingAmount: number;
}

export async function snapshotRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/snapshots - List all snapshots
   * Uses cache for totals to avoid expensive recalculation
   */
  fastify.get<{ Querystring: ListSnapshotsQuery }>(
    '/',
    async (request) => {
      const { assets, last } = request.query;
      const result = fastify.services.snapshotService.listSnapshots({
        assets,
        last: last ? parseInt(last, 10) : undefined,
      });

      // Get all snapshot IDs for cache lookup
      const snapshotIds = result.snapshots.map(({ snapshot }) => snapshot.id);
      const cacheMap = fastify.services.ledgerRepo.getSnapshotTotalsCacheBulk(snapshotIds);

      // Build response with cached totals, calculating on cache miss
      const snapshotsWithTotals = await Promise.all(
        result.snapshots.map(async ({ snapshot, holdingsMap }) => {
          // Check cache first
          const cached = cacheMap.get(snapshot.id);
          if (cached) {
            return {
              ...snapshot,
              holdings_count: holdingsMap.size,
              total_assets_eur: cached.total_assets_eur,
              total_liabilities_eur: cached.total_liabilities_eur,
              net_worth_eur: cached.net_worth_eur,
            };
          }

          // Cache miss: calculate totals
          const holdings = fastify.services.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
          const enrichedHoldings = await fastify.services.portfolioService.enrichHoldingsWithPrices(
            holdings,
            snapshot.date
          );
          const holdingsTotal = enrichedHoldings.reduce(
            (sum, h) => sum + (h.current_value_eur ?? 0),
            0
          );
          // Add real estate equity to total assets
          const realEstateSummary = fastify.services.propertyService.getRealEstateSummary();
          const totalAssets = holdingsTotal + realEstateSummary.totalEquity;
          const liabilityBalances = fastify.services.ledgerRepo.getLiabilityBalancesBySnapshotId(snapshot.id);
          const totalLiabilities = liabilityBalances.reduce(
            (sum, lb) => sum + (lb.outstanding_amount ?? 0),
            0
          );
          const netWorth = totalAssets - totalLiabilities;

          // Save to cache
          fastify.services.ledgerRepo.saveSnapshotTotalsCache({
            snapshot_id: snapshot.id,
            total_assets_eur: totalAssets,
            total_liabilities_eur: totalLiabilities,
            net_worth_eur: netWorth,
          });

          return {
            ...snapshot,
            holdings_count: holdingsMap.size,
            total_assets_eur: totalAssets,
            total_liabilities_eur: totalLiabilities,
            net_worth_eur: netWorth,
          };
        })
      );

      return {
        data: snapshotsWithTotals,
        count: result.totalCount,
      };
    }
  );

  /**
   * GET /api/snapshots/previous - Get previous snapshot data for pre-population
   */
  fastify.get(
    '/previous',
    async () => {
      const result = fastify.services.snapshotService.getPreviousSnapshotData();

      if (!result) {
        return {
          data: null,
          message: 'No previous snapshot found',
        };
      }

      return {
        data: {
          date: result.date,
          holdings: result.holdings,
          liabilityBalances: result.liabilityBalances.map((lb) => ({
            id: lb.id,
            snapshotId: lb.snapshot_id,
            liabilityId: lb.liability_id,
            outstandingAmount: lb.outstanding_amount,
            liabilityName: lb.liability_name,
            liabilityType: lb.liability_type,
            originalAmount: lb.original_amount,
            currency: lb.currency,
            interestRate: lb.interest_rate,
          })),
        },
      };
    }
  );

  /**
   * GET /api/snapshots/:date - Get snapshot by date with holdings and liability balances
   * Holdings are always enriched with calculated values from the rates DB
   * Snapshot totals are recalculated from enriched holdings and saved to cache
   */
  fastify.get<{ Params: DateParams }>(
    '/:date',
    async (request) => {
      const { date } = request.params;
      const result = fastify.services.snapshotService.getSnapshotWithLiabilities(date);

      // Always enrich holdings with calculated values from rates DB
      const enrichedHoldings = await fastify.services.portfolioService.enrichHoldingsWithPrices(
        result.holdings,
        date
      );

      // Calculate totals from enriched holdings (not from stored values)
      const holdingsTotal = enrichedHoldings.reduce(
        (sum, h) => sum + (h.current_value_eur ?? 0),
        0
      );
      // Add real estate equity to total assets
      const realEstateSummary = fastify.services.propertyService.getRealEstateSummary();
      const calculatedTotalAssets = holdingsTotal + realEstateSummary.totalEquity;
      // Liabilities are all in EUR, use outstanding_amount directly
      const totalLiabilities = result.liabilityBalances.reduce(
        (sum, lb) => sum + (lb.outstanding_amount ?? 0),
        0
      );
      const netWorth = calculatedTotalAssets - totalLiabilities;

      // Save calculated totals to cache
      fastify.services.ledgerRepo.saveSnapshotTotalsCache({
        snapshot_id: result.snapshot.id,
        total_assets_eur: calculatedTotalAssets,
        total_liabilities_eur: totalLiabilities,
        net_worth_eur: netWorth,
      });

      return {
        data: {
          snapshot: {
            ...result.snapshot,
            // Add calculated totals (computed from holdings + rates + liabilities)
            total_assets_eur: calculatedTotalAssets,
            total_liabilities_eur: totalLiabilities,
            net_worth_eur: netWorth,
          },
          holdings: enrichedHoldings,
          liabilityBalances: result.liabilityBalances.map((lb) => ({
            id: lb.id,
            snapshotId: lb.snapshot_id,
            liabilityId: lb.liability_id,
            outstandingAmount: lb.outstanding_amount,
            liabilityName: lb.liability_name,
            liabilityType: lb.liability_type,
            originalAmount: lb.original_amount,
            currency: lb.currency,
            interestRate: lb.interest_rate,
          })),
        },
      };
    }
  );

  /**
   * POST /api/snapshots - Create a new snapshot
   */
  fastify.post<{ Body: CreateSnapshotBody }>(
    '/',
    async (request, reply) => {
      const { date, notes } = request.body;
      const snapshot = fastify.services.snapshotService.createSnapshot(date, notes);

      reply.status(201);
      return {
        data: snapshot,
      };
    }
  );

  /**
   * DELETE /api/snapshots/:date - Delete a snapshot
   */
  fastify.delete<{ Params: DateParams }>(
    '/:date',
    async (request) => {
      const { date } = request.params;
      const result = fastify.services.snapshotService.deleteSnapshot(date);

      return {
        data: {
          snapshot: result.snapshot,
          deletedHoldingsCount: result.deletedHoldingsCount,
        },
      };
    }
  );

  /**
   * POST /api/snapshots/:date/holdings - Add a holding to a snapshot
   * Optionally accepts priceOverride to save manual price to rates DB
   */
  fastify.post<{ Params: DateParams; Body: AddHoldingBody }>(
    '/:date/holdings',
    async (request, reply) => {
      const { date } = request.params;
      const { assetId, amount, priceOverride } = request.body;

      // Get or create snapshot
      const { snapshot } = fastify.services.snapshotService.getOrCreateSnapshot(date);

      // Add holding
      const result = fastify.services.snapshotService.addHolding(snapshot.id, assetId, amount);

      // If price override provided, save to historical_rates with source='manual'
      if (priceOverride !== undefined && priceOverride !== null) {
        const asset = fastify.services.ledgerRepo.getAssetById(assetId);
        if (asset) {
          const timestamp = `${date}T12:00:00.000Z`;
          fastify.services.ratesRepo.saveHistoricalRate({
            asset_symbol: asset.symbol,
            base_currency: 'EUR',
            price: priceOverride,
            timestamp,
            source: 'manual',
          });
        }
      }

      reply.status(result.isUpdate ? 200 : 201);
      return {
        data: {
          holding: result.holding,
          isUpdate: result.isUpdate,
        },
      };
    }
  );

  /**
   * PUT /api/snapshots/:date/holdings/:assetId - Update a holding
   */
  fastify.put<{ Params: HoldingParams; Body: UpdateHoldingBody }>(
    '/:date/holdings/:assetId',
    async (request: FastifyRequest<{ Params: HoldingParams; Body: UpdateHoldingBody }>) => {
      const { date, assetId } = request.params;
      const { amount, notes } = request.body;

      const result = fastify.services.snapshotService.updateHolding(
        date,
        parseInt(assetId, 10),
        { amount, notes }
      );

      return {
        data: {
          holding: result.holding,
          previousAmount: result.previousAmount,
        },
      };
    }
  );

  /**
   * DELETE /api/snapshots/:date/holdings/:assetId - Delete a holding by asset symbol
   */
  fastify.delete<{ Params: HoldingParams }>(
    '/:date/holdings/:assetId',
    async (request) => {
      const { date, assetId } = request.params;

      // Get asset symbol from asset ID
      const asset = fastify.services.ledgerRepo.getAssetById(parseInt(assetId, 10));
      if (!asset) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      const result = fastify.services.snapshotService.deleteHolding(date, asset.symbol);

      return {
        data: {
          deletedHolding: result.deletedHolding,
          remainingHoldingsCount: result.remainingHoldings.length,
        },
      };
    }
  );

  // ==========================================================================
  // Liability Balance endpoints
  // ==========================================================================

  /**
   * POST /api/snapshots/:date/liabilities - Add a liability balance to a snapshot
   */
  fastify.post<{ Params: DateParams; Body: AddLiabilityBalanceBody }>(
    '/:date/liabilities',
    async (request, reply) => {
      const { date } = request.params;
      const { liabilityId, outstandingAmount } = request.body;

      // Get or create snapshot
      fastify.services.snapshotService.getOrCreateSnapshot(date);

      // Add liability balance
      const result = fastify.services.snapshotService.addLiabilityBalance(
        date,
        liabilityId,
        outstandingAmount
      );

      reply.status(result.isUpdate ? 200 : 201);
      return {
        data: {
          liabilityBalance: {
            id: result.liabilityBalance.id,
            snapshotId: result.liabilityBalance.snapshot_id,
            liabilityId: result.liabilityBalance.liability_id,
            outstandingAmount: result.liabilityBalance.outstanding_amount,
            liabilityName: result.liabilityBalance.liability_name,
            liabilityType: result.liabilityBalance.liability_type,
            originalAmount: result.liabilityBalance.original_amount,
            currency: result.liabilityBalance.currency,
            interestRate: result.liabilityBalance.interest_rate,
          },
          isUpdate: result.isUpdate,
        },
      };
    }
  );

  /**
   * PUT /api/snapshots/:date/liabilities/:liabilityId - Update a liability balance
   */
  fastify.put<{ Params: LiabilityBalanceParams; Body: UpdateLiabilityBalanceBody }>(
    '/:date/liabilities/:liabilityId',
    async (request) => {
      const { date, liabilityId } = request.params;
      const { outstandingAmount } = request.body;

      const result = fastify.services.snapshotService.updateLiabilityBalance(
        date,
        parseInt(liabilityId, 10),
        outstandingAmount
      );

      return {
        data: {
          liabilityBalance: {
            id: result.liabilityBalance.id,
            snapshotId: result.liabilityBalance.snapshot_id,
            liabilityId: result.liabilityBalance.liability_id,
            outstandingAmount: result.liabilityBalance.outstanding_amount,
            liabilityName: result.liabilityBalance.liability_name,
            liabilityType: result.liabilityBalance.liability_type,
            originalAmount: result.liabilityBalance.original_amount,
            currency: result.liabilityBalance.currency,
            interestRate: result.liabilityBalance.interest_rate,
          },
          previousAmount: result.previousAmount,
        },
      };
    }
  );

  /**
   * DELETE /api/snapshots/:date/liabilities/:liabilityId - Delete a liability balance
   */
  fastify.delete<{ Params: LiabilityBalanceParams }>(
    '/:date/liabilities/:liabilityId',
    async (request) => {
      const { date, liabilityId } = request.params;

      fastify.services.snapshotService.deleteLiabilityBalance(
        date,
        parseInt(liabilityId, 10)
      );

      return {
        data: {
          deleted: true,
        },
      };
    }
  );
}
