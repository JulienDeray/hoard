import type Database from 'better-sqlite3';
import { Logger } from '../../utils/logger.js';

export interface BackfillResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Clear all snapshot totals cache entries
 * Forces recalculation which now includes real estate equity
 */
function clearSnapshotTotalsCache(ledgerDb: Database.Database): BackfillResult {
  Logger.info('Clearing snapshot totals cache (will recalculate with real estate)...');

  const stmt = ledgerDb.prepare('DELETE FROM snapshot_totals_cache');
  const result = stmt.run();

  Logger.info(`Cleared ${result.changes} cached snapshot totals`);

  return {
    processed: result.changes,
    updated: result.changes,
    skipped: 0,
    errors: [],
  };
}

/**
 * Runs all backfill operations after schema migration
 */
export async function runAllBackfills(
  ledgerDb: Database.Database
): Promise<{
  snapshots: BackfillResult;
}> {
  Logger.info('Starting backfill operations...');

  // Clear snapshot totals cache so they get recalculated with real estate equity
  const cacheResult = clearSnapshotTotalsCache(ledgerDb);

  Logger.success('All backfill operations complete');

  return {
    snapshots: cacheResult,
  };
}
