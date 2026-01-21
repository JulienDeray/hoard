/**
 * Route Registration
 *
 * Registers all API routes with the Fastify instance.
 */

import type { FastifyInstance } from 'fastify';
import { snapshotRoutes } from './snapshots.js';
import { assetRoutes } from './assets.js';
import { allocationRoutes } from './allocations.js';
import { portfolioRoutes } from './portfolio.js';
import { priceRoutes } from './prices.js';

/**
 * Register all API routes under /api prefix
 */
export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check endpoint
  fastify.get('/api/health', async () => {
    return { status: 'ok' };
  });

  // Register route modules
  await fastify.register(snapshotRoutes, { prefix: '/api/snapshots' });
  await fastify.register(assetRoutes, { prefix: '/api/assets' });
  await fastify.register(allocationRoutes, { prefix: '/api/allocations' });
  await fastify.register(portfolioRoutes, { prefix: '/api/portfolio' });
  await fastify.register(priceRoutes, { prefix: '/api/prices' });
}
