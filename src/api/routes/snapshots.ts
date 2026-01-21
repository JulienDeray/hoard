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
}

interface UpdateHoldingBody {
  amount?: number;
  valueEur?: number;
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
   */
  fastify.get<{ Querystring: ListSnapshotsQuery }>(
    '/',
    async (request) => {
      const { assets, last } = request.query;
      const result = fastify.services.snapshotService.listSnapshots({
        assets,
        last: last ? parseInt(last, 10) : undefined,
      });

      return {
        data: result.snapshots.map(({ snapshot, holdingsMap }) => ({
          ...snapshot,
          holdings_count: holdingsMap.size,
        })),
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
            valueEur: lb.value_eur,
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
   */
  fastify.get<{ Params: DateParams }>(
    '/:date',
    async (request) => {
      const { date } = request.params;
      const result = fastify.services.snapshotService.getSnapshotWithLiabilities(date);

      return {
        data: {
          snapshot: result.snapshot,
          holdings: result.holdings,
          liabilityBalances: result.liabilityBalances.map((lb) => ({
            id: lb.id,
            snapshotId: lb.snapshot_id,
            liabilityId: lb.liability_id,
            outstandingAmount: lb.outstanding_amount,
            valueEur: lb.value_eur,
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
   */
  fastify.post<{ Params: DateParams; Body: AddHoldingBody }>(
    '/:date/holdings',
    async (request, reply) => {
      const { date } = request.params;
      const { assetId, amount } = request.body;

      // Get or create snapshot
      const { snapshot } = fastify.services.snapshotService.getOrCreateSnapshot(date);

      // Add holding
      const result = fastify.services.snapshotService.addHolding(snapshot.id, assetId, amount);

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
      const { amount, valueEur, notes } = request.body;

      const result = fastify.services.snapshotService.updateHolding(
        date,
        parseInt(assetId, 10),
        { amount, valueEur, notes }
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
            valueEur: result.liabilityBalance.value_eur,
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
            valueEur: result.liabilityBalance.value_eur,
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
