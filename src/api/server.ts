/**
 * API Server
 *
 * Fastify instance with CORS and route registration.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { initializeContext, type InitializeContextOptions } from './context.js';
import { apiErrorHandler } from './error-handler.js';
import { registerRoutes } from './routes/index.js';

export interface CreateServerOptions extends InitializeContextOptions {
  logger?: boolean;
}

/**
 * Create and configure the Fastify server
 */
export async function createServer(options: CreateServerOptions): Promise<FastifyInstance> {
  const { env, logger = true } = options;

  // Create Fastify instance with logging
  const fastify = Fastify({
    logger: logger
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        }
      : false,
  });

  // Register CORS for web UI (localhost:5173)
  await fastify.register(cors, {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Initialize services and context
  await initializeContext(fastify, { env });

  // Set error handler
  fastify.setErrorHandler(apiErrorHandler);

  // Register routes
  await registerRoutes(fastify);

  return fastify;
}

/**
 * Start the server
 */
export async function startServer(
  fastify: FastifyInstance,
  port: number,
  host = '0.0.0.0'
): Promise<void> {
  try {
    await fastify.listen({ port, host });
  } catch (err) {
    fastify.log.error(err);
    throw err;
  }
}
