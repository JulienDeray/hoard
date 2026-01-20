/**
 * CLI Error Handler
 *
 * Centralized error handling for CLI commands.
 * Maps ServiceError types to user-friendly messages and handles cleanup.
 */

import * as clack from '@clack/prompts';
import { DatabaseManager } from '../../database/connection.js';
import { Logger } from '../../utils/logger.js';
import {
  ServiceError,
  SnapshotNotFoundError,
  SnapshotAlreadyExistsError,
  AssetNotFoundError,
  AssetDiscoveryError,
  HoldingNotFoundError,
  InvalidDateError,
  InvalidAmountError,
  AllocationTargetsSumError,
  DuplicateAllocationTargetError,
  NoAllocationTargetsError,
  NoPortfolioDataError,
  PriceFetchError,
} from '../../errors/index.js';

export interface ErrorHandlerOptions {
  /** Custom outro message (defaults to error-specific message) */
  outro?: string;
  /** Exit code (defaults to 1 for errors, 0 for non-fatal conditions) */
  exitCode?: number;
  /** Whether to call process.exit (defaults to true) */
  exit?: boolean;
}

/**
 * Handle service errors in CLI commands
 *
 * Maps ServiceError types to user-friendly messages, closes database connections,
 * and exits the process with appropriate code.
 *
 * @param error - The error to handle
 * @param options - Optional configuration
 */
export function handleServiceError(error: unknown, options: ErrorHandlerOptions = {}): never {
  const { exit = true, exitCode = 1 } = options;

  // Ensure database connections are closed
  DatabaseManager.closeAll();

  // Handle specific error types
  if (error instanceof SnapshotNotFoundError) {
    Logger.error(`No snapshot found for ${error.date}`);
    clack.outro(options.outro || 'Snapshot not found');
    if (exit) process.exit(exitCode);
  }

  if (error instanceof SnapshotAlreadyExistsError) {
    Logger.error(`Snapshot already exists for ${error.date} with ${error.holdingsCount} holding(s)`);
    clack.outro(options.outro || 'Snapshot already exists');
    if (exit) process.exit(exitCode);
  }

  if (error instanceof AssetNotFoundError) {
    Logger.error(`Asset ${error.symbol} not found in database`);
    clack.outro(options.outro || 'Asset not found');
    if (exit) process.exit(exitCode);
  }

  if (error instanceof AssetDiscoveryError) {
    Logger.error(`Could not discover asset ${error.symbol}: ${error.reason}`);
    clack.outro(options.outro || 'Asset discovery failed');
    if (exit) process.exit(exitCode);
  }

  if (error instanceof HoldingNotFoundError) {
    Logger.error(`Asset ${error.symbol} not found in snapshot ${error.snapshotDate}`);
    clack.outro(options.outro || 'Holding not found');
    if (exit) process.exit(exitCode);
  }

  if (error instanceof InvalidDateError) {
    Logger.error(`Invalid date format: ${error.date}. Use YYYY-MM-DD`);
    clack.outro(options.outro || 'Invalid date format');
    if (exit) process.exit(exitCode);
  }

  if (error instanceof InvalidAmountError) {
    Logger.error(`Invalid amount: ${error.amount}. Must be a positive number`);
    clack.outro(options.outro || 'Invalid amount');
    if (exit) process.exit(exitCode);
  }

  if (error instanceof AllocationTargetsSumError) {
    Logger.error(`Allocation targets sum to ${error.sum.toFixed(2)}%, must equal 100%`);
    clack.outro(options.outro || 'Invalid allocation sum');
    if (exit) process.exit(exitCode);
  }

  if (error instanceof DuplicateAllocationTargetError) {
    Logger.error(`Duplicate allocation target: ${error.targetKey}`);
    clack.outro(options.outro || 'Duplicate target');
    if (exit) process.exit(exitCode);
  }

  if (error instanceof NoAllocationTargetsError) {
    Logger.info('No allocation targets set');
    clack.outro(options.outro || 'No targets found');
    // This is often a non-fatal condition
    if (exit) process.exit(options.exitCode ?? 0);
  }

  if (error instanceof NoPortfolioDataError) {
    const message = error.date
      ? `No portfolio data found for ${error.date}`
      : 'No portfolio data found';
    Logger.info(message);
    clack.outro(options.outro || 'No portfolio data');
    // This is often a non-fatal condition
    if (exit) process.exit(options.exitCode ?? 0);
  }

  if (error instanceof PriceFetchError) {
    Logger.error(`Could not fetch price for ${error.symbol}: ${error.reason}`);
    clack.outro(options.outro || 'Price fetch failed');
    if (exit) process.exit(exitCode);
  }

  // Generic ServiceError
  if (error instanceof ServiceError) {
    Logger.error(error.message);
    clack.outro(options.outro || 'Operation failed');
    if (exit) process.exit(exitCode);
  }

  // Unknown error
  Logger.error(error instanceof Error ? error.message : String(error));
  clack.outro(options.outro || 'An unexpected error occurred');
  if (exit) process.exit(exitCode);

  // TypeScript needs this for the never return type
  throw error;
}

/**
 * Wrapper for async CLI command handlers that automatically handles errors
 *
 * @param handler - The async command handler function
 * @returns A wrapped function that handles errors
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<void>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      await handler(...args);
    } catch (error) {
      handleServiceError(error);
    }
  }) as T;
}
