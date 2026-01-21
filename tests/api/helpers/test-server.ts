/**
 * Test Server Helper
 *
 * Creates a Fastify server with mocked services for testing API routes.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { vi } from 'vitest';
import { apiErrorHandler } from '../../../src/api/error-handler.js';
import { registerRoutes } from '../../../src/api/routes/index.js';
import type { ApiServices } from '../../../src/api/context.js';

export interface MockServices {
  snapshotService: ReturnType<typeof createMockSnapshotService>;
  allocationTargetService: ReturnType<typeof createMockAllocationTargetService>;
  allocationService: ReturnType<typeof createMockAllocationService>;
  portfolioService: ReturnType<typeof createMockPortfolioService>;
  ledgerRepo: ReturnType<typeof createMockLedgerRepo>;
  ratesRepo: ReturnType<typeof createMockRatesRepo>;
  liabilityService: ReturnType<typeof createMockLiabilityService>;
}

export function createMockSnapshotService() {
  return {
    listSnapshots: vi.fn(),
    getSnapshotByDate: vi.fn(),
    getSnapshotWithLiabilities: vi.fn(),
    getLatestSnapshot: vi.fn(),
    getPreviousSnapshotData: vi.fn(),
    createSnapshot: vi.fn(),
    deleteSnapshot: vi.fn(),
    getOrCreateSnapshot: vi.fn(),
    addHolding: vi.fn(),
    updateHolding: vi.fn(),
    deleteHolding: vi.fn(),
    getLiabilityBalances: vi.fn(),
    addLiabilityBalance: vi.fn(),
    updateLiabilityBalance: vi.fn(),
    deleteLiabilityBalance: vi.fn(),
    recalculateSnapshotTotals: vi.fn(),
    listAssets: vi.fn(),
    searchAssets: vi.fn(),
    checkSnapshotExists: vi.fn(),
    getHoldingsBySnapshotId: vi.fn(),
  };
}

export function createMockLiabilityService() {
  return {
    listLiabilities: vi.fn(),
    getLiabilityById: vi.fn(),
    createLiability: vi.fn(),
    updateLiability: vi.fn(),
    deleteLiability: vi.fn(),
  };
}

export function createMockAllocationTargetService() {
  return {
    listTargets: vi.fn(),
    setTargets: vi.fn(),
    clearTargets: vi.fn(),
  };
}

export function createMockAllocationService() {
  return {
    getAllocationSummary: vi.fn(),
    getRebalancingSuggestions: vi.fn(),
  };
}

export function createMockPortfolioService() {
  return {
    getPortfolioValue: vi.fn(),
    getCurrentPrices: vi.fn(),
    refreshPrices: vi.fn(),
    enrichHoldingsWithPrices: vi.fn(),
    fetchAndCachePrices: vi.fn(),
  };
}

export function createMockLedgerRepo() {
  return {
    getAssetById: vi.fn(),
    listAssets: vi.fn(),
    getSnapshotByDate: vi.fn(),
    getHoldingsBySnapshotId: vi.fn(),
    listAllocationTargets: vi.fn(),
    validateAllocationTargets: vi.fn(),
  };
}

export function createMockRatesRepo() {
  return {
    getCachedRate: vi.fn(),
    updateCachedRate: vi.fn(),
    getHistoricalRate: vi.fn(),
    saveHistoricalRate: vi.fn(),
  };
}

export function createMockServices(): MockServices {
  return {
    snapshotService: createMockSnapshotService(),
    allocationTargetService: createMockAllocationTargetService(),
    allocationService: createMockAllocationService(),
    portfolioService: createMockPortfolioService(),
    ledgerRepo: createMockLedgerRepo(),
    ratesRepo: createMockRatesRepo(),
    liabilityService: createMockLiabilityService(),
  };
}

/**
 * Create a test server with mocked services
 */
export async function createTestServer(
  mockServices?: Partial<MockServices>
): Promise<{ server: FastifyInstance; services: MockServices }> {
  const services = {
    ...createMockServices(),
    ...mockServices,
  };

  const server = Fastify({
    logger: false,
  });

  // Decorate with services
  server.decorate('services', services as unknown as ApiServices);

  // Set error handler
  server.setErrorHandler(apiErrorHandler);

  // Register routes
  await registerRoutes(server);

  return { server, services };
}
