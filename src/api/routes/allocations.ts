/**
 * Allocation Routes
 *
 * GET /api/allocations/targets - List allocation targets
 * GET /api/allocations/compare - Compare current allocation vs targets
 * PUT /api/allocations/targets - Set allocation targets
 * DELETE /api/allocations/targets - Clear all targets
 */

import type { FastifyInstance } from 'fastify';
import type { CreateAllocationTargetInput } from '../../models/index.js';

interface CompareQuery {
  date?: string;
}

interface SetTargetsBody {
  targets: CreateAllocationTargetInput[];
  allowInvalidSum?: boolean;
}

export async function allocationRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/allocations/targets - List allocation targets
   */
  fastify.get('/targets', async () => {
    const targets = fastify.services.allocationTargetService.listTargets();

    return {
      data: targets,
      count: targets.length,
    };
  });

  /**
   * GET /api/allocations/compare - Compare current allocation vs targets
   */
  fastify.get<{ Querystring: CompareQuery }>(
    '/compare',
    async (request) => {
      const { date } = request.query;
      const summary = await fastify.services.allocationService.getAllocationSummary(date);

      if (!summary) {
        return {
          data: null,
          message: 'No portfolio data found',
        };
      }

      return {
        data: summary,
      };
    }
  );

  /**
   * PUT /api/allocations/targets - Set allocation targets (replaces existing)
   */
  fastify.put<{ Body: SetTargetsBody }>(
    '/targets',
    async (request) => {
      const { targets, allowInvalidSum } = request.body;

      const result = fastify.services.allocationTargetService.setTargets({
        targets,
        allowInvalidSum,
      });

      return {
        data: result.targets,
        validation: result.validation,
      };
    }
  );

  /**
   * DELETE /api/allocations/targets - Clear all allocation targets
   */
  fastify.delete('/targets', async () => {
    const cleared = fastify.services.allocationTargetService.clearTargets();

    return {
      data: {
        cleared,
      },
    };
  });
}
