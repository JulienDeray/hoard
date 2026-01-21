/**
 * Asset Routes
 *
 * GET /api/assets - List all assets
 * GET /api/assets/search - Search assets by query
 */

import type { FastifyInstance } from 'fastify';

interface SearchQuery {
  q?: string;
  limit?: string;
}

export async function assetRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/assets - List all assets
   */
  fastify.get('/', async () => {
    const assets = fastify.services.snapshotService.listAssets();

    return {
      data: assets,
      count: assets.length,
    };
  });

  /**
   * GET /api/assets/search - Search assets by query (prefix match on symbol/name)
   */
  fastify.get<{ Querystring: SearchQuery }>(
    '/search',
    async (request) => {
      const { q, limit } = request.query;
      const searchLimit = limit ? parseInt(limit, 10) : 10;

      const assets = fastify.services.snapshotService.searchAssets(q || '', searchLimit);

      return {
        data: assets,
        count: assets.length,
      };
    }
  );
}
