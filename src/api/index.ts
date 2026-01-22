#!/usr/bin/env node

/**
 * API Entry Point
 *
 * Starts the Fastify API server with environment selection via HOARD_ENV.
 *
 * Usage:
 *   HOARD_ENV=dev npm run dev:api    # Development environment
 *   HOARD_ENV=prod npm run dev:api   # Production environment
 */

import { config } from 'dotenv';
import { createServer, startServer } from './server.js';
import { configManager } from '../utils/config.js';

// Load environment variables
config();

async function main() {
  // Determine environment from HOARD_ENV (default to 'dev')
  const env = (process.env.HOARD_ENV as 'dev' | 'prod') || 'dev';

  if (!['dev', 'prod'].includes(env)) {
    console.error(`Invalid HOARD_ENV: ${env}. Must be 'dev' or 'prod'.`);
    process.exit(1);
  }

  // Validate configuration
  try {
    if (!configManager.isConfigured()) {
      console.error('Error: API keys not configured.');
      console.error('Please set CMC_API_KEY in .env');
      process.exit(1);
    }
  } catch {
    console.error('Configuration error. Please check your .env file.');
    process.exit(1);
  }

  // Get port from environment or default
  const port = parseInt(process.env.PORT || '3001', 10);

  try {
    // Create and start server
    const fastify = await createServer({ env, logger: true });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      fastify.log.info(`Received ${signal}, shutting down gracefully...`);
      await fastify.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Start server
    await startServer(fastify, port);

    fastify.log.info(`API server running in ${env.toUpperCase()} mode`);
    fastify.log.info(`Listening on http://localhost:${port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
