/**
 * API Error Handler
 *
 * Maps ServiceError codes to HTTP status codes and formats error responses.
 */

import type { FastifyReply, FastifyError } from 'fastify';
import { ServiceError } from '../errors/index.js';

// ServiceError code to HTTP status mapping
const ERROR_STATUS_MAP: Record<string, number> = {
  // 404 Not Found
  SNAPSHOT_NOT_FOUND: 404,
  ASSET_NOT_FOUND: 404,
  HOLDING_NOT_FOUND: 404,
  NO_ALLOCATION_TARGETS: 404,
  NO_PORTFOLIO_DATA: 404,
  LIABILITY_NOT_FOUND: 404,
  LIABILITY_BALANCE_NOT_FOUND: 404,

  // 409 Conflict
  SNAPSHOT_ALREADY_EXISTS: 409,

  // 400 Bad Request
  INVALID_DATE: 400,
  INVALID_AMOUNT: 400,
  ALLOCATION_TARGETS_SUM_INVALID: 400,
  DUPLICATE_ALLOCATION_TARGET: 400,

  // 502 Bad Gateway
  PRICE_FETCH_FAILED: 502,
  ASSET_DISCOVERY_FAILED: 502,
};

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Map a ServiceError to its HTTP status code
 */
export function getHttpStatus(error: ServiceError): number {
  return ERROR_STATUS_MAP[error.code] ?? 500;
}

/**
 * Format a ServiceError as an API error response
 */
export function formatErrorResponse(error: ServiceError): ApiErrorResponse {
  return {
    error: error.message,
    code: error.code,
  };
}

/**
 * Fastify error handler for ServiceErrors and generic errors
 */
export function apiErrorHandler(
  error: FastifyError | ServiceError | Error,
  _request: unknown,
  reply: FastifyReply
): void {
  if (error instanceof ServiceError) {
    const status = getHttpStatus(error);
    const response = formatErrorResponse(error);
    reply.status(status).send(response);
    return;
  }

  // Fastify validation errors
  if ('validation' in error && error.validation) {
    reply.status(400).send({
      error: error.message,
      code: 'VALIDATION_ERROR',
      details: { validation: error.validation },
    });
    return;
  }

  // Generic errors
  const message = error instanceof Error ? error.message : String(error);
  reply.status(500).send({
    error: message,
    code: 'INTERNAL_ERROR',
  });
}
