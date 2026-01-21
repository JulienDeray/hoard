import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, type MockServices } from '../helpers/test-server.js';
import { NoAllocationTargetsError, AllocationTargetsSumError } from '../../../src/errors/index.js';

describe('Allocation Routes', () => {
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

  describe('GET /api/allocations/targets', () => {
    it('should return allocation targets', async () => {
      services.allocationTargetService.listTargets.mockReturnValue([
        { id: 1, target_type: 'ASSET', target_key: 'BTC', target_percentage: 50 },
        { id: 2, target_type: 'ASSET', target_key: 'ETH', target_percentage: 50 },
      ]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/allocations/targets',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.count).toBe(2);
    });

    it('should handle empty targets', async () => {
      services.allocationTargetService.listTargets.mockReturnValue([]);

      const response = await server.inject({
        method: 'GET',
        url: '/api/allocations/targets',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(0);
      expect(body.count).toBe(0);
    });
  });

  describe('GET /api/allocations/compare', () => {
    it('should return allocation comparison', async () => {
      services.allocationService.getAllocationSummary.mockResolvedValue({
        date: '2024-01-15',
        total_value: 50000,
        currency: 'EUR',
        allocations: [
          {
            target_type: 'ASSET',
            target_key: 'BTC',
            current_percentage: 45,
            target_percentage: 50,
            difference_percentage: -5,
            is_within_tolerance: true,
          },
        ],
        has_targets: true,
        targets_sum_valid: true,
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/allocations/compare',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.total_value).toBe(50000);
      expect(body.data.allocations).toHaveLength(1);
    });

    it('should return null when no portfolio data', async () => {
      services.allocationService.getAllocationSummary.mockResolvedValue(null);

      const response = await server.inject({
        method: 'GET',
        url: '/api/allocations/compare',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should pass date query parameter to service', async () => {
      services.allocationService.getAllocationSummary.mockResolvedValue(null);

      await server.inject({
        method: 'GET',
        url: '/api/allocations/compare?date=2024-01-15',
      });

      expect(services.allocationService.getAllocationSummary).toHaveBeenCalledWith('2024-01-15');
    });
  });

  describe('PUT /api/allocations/targets', () => {
    it('should set allocation targets', async () => {
      services.allocationTargetService.setTargets.mockReturnValue({
        targets: [
          { id: 1, target_type: 'ASSET', target_key: 'BTC', target_percentage: 50 },
          { id: 2, target_type: 'ASSET', target_key: 'ETH', target_percentage: 50 },
        ],
        validation: { valid: true, sum: 100, errors: [] },
      });

      const response = await server.inject({
        method: 'PUT',
        url: '/api/allocations/targets',
        payload: {
          targets: [
            { target_type: 'ASSET', target_key: 'BTC', target_percentage: 50 },
            { target_type: 'ASSET', target_key: 'ETH', target_percentage: 50 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.validation.valid).toBe(true);
    });

    it('should return 400 if targets sum is invalid', async () => {
      services.allocationTargetService.setTargets.mockImplementation(() => {
        throw new AllocationTargetsSumError(95);
      });

      const response = await server.inject({
        method: 'PUT',
        url: '/api/allocations/targets',
        payload: {
          targets: [{ target_type: 'ASSET', target_key: 'BTC', target_percentage: 95 }],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('ALLOCATION_TARGETS_SUM_INVALID');
    });
  });

  describe('DELETE /api/allocations/targets', () => {
    it('should clear all targets', async () => {
      services.allocationTargetService.clearTargets.mockReturnValue(5);

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/allocations/targets',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.cleared).toBe(5);
    });

    it('should return 404 if no targets exist', async () => {
      services.allocationTargetService.clearTargets.mockImplementation(() => {
        throw new NoAllocationTargetsError();
      });

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/allocations/targets',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NO_ALLOCATION_TARGETS');
    });
  });
});
