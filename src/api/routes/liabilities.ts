/**
 * Liability Routes
 *
 * GET /api/liabilities - List all active liabilities
 * GET /api/liabilities/:id - Get liability by ID
 * POST /api/liabilities - Create a new liability
 * PUT /api/liabilities/:id - Update a liability
 * DELETE /api/liabilities/:id - Soft delete a liability
 */

import type { FastifyInstance } from 'fastify';
import type { CreateLiabilityInput, UpdateLiabilityInput } from '../../models/index.js';

// Query/Param types
interface IdParams {
  id: string;
}

interface ListLiabilitiesQuery {
  activeOnly?: string;
}

interface CreateLiabilityBody {
  name: string;
  liabilityType: 'LOAN' | 'MORTGAGE' | 'CREDIT_LINE';
  originalAmount: number;
  currency?: string;
  interestRate?: number;
  startDate?: string;
  termMonths?: number;
  linkedAssetId?: number;
  notes?: string;
}

interface UpdateLiabilityBody {
  name?: string;
  liabilityType?: 'LOAN' | 'MORTGAGE' | 'CREDIT_LINE';
  interestRate?: number;
  linkedAssetId?: number;
  notes?: string;
}

export async function liabilityRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/liabilities - List all liabilities
   */
  fastify.get<{ Querystring: ListLiabilitiesQuery }>(
    '/',
    async (request) => {
      const activeOnly = request.query.activeOnly !== 'false';
      const liabilities = fastify.services.liabilityService.listLiabilities(activeOnly);

      return {
        data: liabilities.map((l) => ({
          id: l.id,
          name: l.name,
          liabilityType: l.liability_type,
          linkedAssetId: l.linked_asset_id,
          originalAmount: l.original_amount,
          currency: l.currency,
          interestRate: l.interest_rate,
          startDate: l.start_date,
          termMonths: l.term_months,
          isActive: l.is_active,
          notes: l.notes,
          createdAt: l.created_at,
          updatedAt: l.updated_at,
        })),
        count: liabilities.length,
      };
    }
  );

  /**
   * GET /api/liabilities/:id - Get liability by ID
   */
  fastify.get<{ Params: IdParams }>(
    '/:id',
    async (request) => {
      const { id } = request.params;
      const liability = fastify.services.liabilityService.getLiabilityById(parseInt(id, 10));

      return {
        data: {
          id: liability.id,
          name: liability.name,
          liabilityType: liability.liability_type,
          linkedAssetId: liability.linked_asset_id,
          originalAmount: liability.original_amount,
          currency: liability.currency,
          interestRate: liability.interest_rate,
          startDate: liability.start_date,
          termMonths: liability.term_months,
          isActive: liability.is_active,
          notes: liability.notes,
          createdAt: liability.created_at,
          updatedAt: liability.updated_at,
        },
      };
    }
  );

  /**
   * POST /api/liabilities - Create a new liability
   */
  fastify.post<{ Body: CreateLiabilityBody }>(
    '/',
    async (request, reply) => {
      const {
        name,
        liabilityType,
        originalAmount,
        currency,
        interestRate,
        startDate,
        termMonths,
        linkedAssetId,
        notes,
      } = request.body;

      const input: CreateLiabilityInput = {
        name,
        liability_type: liabilityType,
        original_amount: originalAmount,
        currency,
        interest_rate: interestRate,
        start_date: startDate,
        term_months: termMonths,
        linked_asset_id: linkedAssetId,
        notes,
      };

      const result = fastify.services.liabilityService.createLiability(input);

      reply.status(201);
      return {
        data: {
          id: result.liability.id,
          name: result.liability.name,
          liabilityType: result.liability.liability_type,
          linkedAssetId: result.liability.linked_asset_id,
          originalAmount: result.liability.original_amount,
          currency: result.liability.currency,
          interestRate: result.liability.interest_rate,
          startDate: result.liability.start_date,
          termMonths: result.liability.term_months,
          isActive: result.liability.is_active,
          notes: result.liability.notes,
          createdAt: result.liability.created_at,
          updatedAt: result.liability.updated_at,
        },
      };
    }
  );

  /**
   * PUT /api/liabilities/:id - Update a liability
   */
  fastify.put<{ Params: IdParams; Body: UpdateLiabilityBody }>(
    '/:id',
    async (request) => {
      const { id } = request.params;
      const { name, liabilityType, interestRate, linkedAssetId, notes } = request.body;

      const input: UpdateLiabilityInput = {};
      if (name !== undefined) input.name = name;
      if (liabilityType !== undefined) input.liability_type = liabilityType;
      if (interestRate !== undefined) input.interest_rate = interestRate;
      if (linkedAssetId !== undefined) input.linked_asset_id = linkedAssetId;
      if (notes !== undefined) input.notes = notes;

      const result = fastify.services.liabilityService.updateLiability(
        parseInt(id, 10),
        input
      );

      return {
        data: {
          id: result.liability.id,
          name: result.liability.name,
          liabilityType: result.liability.liability_type,
          linkedAssetId: result.liability.linked_asset_id,
          originalAmount: result.liability.original_amount,
          currency: result.liability.currency,
          interestRate: result.liability.interest_rate,
          startDate: result.liability.start_date,
          termMonths: result.liability.term_months,
          isActive: result.liability.is_active,
          notes: result.liability.notes,
          createdAt: result.liability.created_at,
          updatedAt: result.liability.updated_at,
        },
      };
    }
  );

  /**
   * DELETE /api/liabilities/:id - Soft delete a liability
   */
  fastify.delete<{ Params: IdParams }>(
    '/:id',
    async (request) => {
      const { id } = request.params;
      fastify.services.liabilityService.deleteLiability(parseInt(id, 10));

      return {
        data: {
          deleted: true,
        },
      };
    }
  );
}
