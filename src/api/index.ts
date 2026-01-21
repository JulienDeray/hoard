#!/usr/bin/env node

/**
 * API Entry Point
 *
 * Starts the Fastify API server with environment selection.
 */

import { config } from 'dotenv';
import * as prompts from '@clack/prompts';
import pc from 'picocolors';
import { createServer, startServer } from './server.js';
import { configManager } from '../utils/config.js';

// Load environment variables
config();

async function main() {
  // Determine environment
  let env = process.env.HOARD_ENV as 'dev' | 'prod' | undefined;

  if (!env || !['dev', 'prod'].includes(env)) {
    // Interactive prompt for environment selection
    console.log();
    prompts.intro(pc.cyan('Hoard API Server'));

    const envResult = await prompts.select({
      message: 'Select environment',
      options: [
        { value: 'dev', label: 'Development', hint: 'Uses data/dev/ databases' },
        { value: 'prod', label: 'Production', hint: 'Uses data/prod/ databases' },
      ],
    });

    if (prompts.isCancel(envResult)) {
      prompts.cancel('Cancelled');
      process.exit(0);
    }

    env = envResult as 'dev' | 'prod';
  }

  // Validate configuration
  try {
    if (!configManager.isConfigured()) {
      console.error(pc.red('Error: API keys not configured.'));
      console.error(pc.cyan('Please set them in .env or run: npm run init'));
      process.exit(1);
    }
  } catch {
    console.error(pc.red('Configuration error. Please run: npm run init'));
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

    fastify.log.info(pc.green(`API server running in ${env.toUpperCase()} mode`));
    fastify.log.info(pc.cyan(`Listening on http://localhost:${port}`));
  } catch (error) {
    console.error(pc.red('Failed to start server:'), error);
    process.exit(1);
  }
}

main();
