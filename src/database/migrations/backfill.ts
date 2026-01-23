import type Database from 'better-sqlite3';

export interface BackfillResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Clear all snapshot totals cache entries
 * Forces recalculation which now:
 * - Includes real estate equity
 * - Excludes mortgages from totalLiabilities (they're already in real estate equity)
 */
function clearSnapshotTotalsCache(ledgerDb: Database.Database): BackfillResult {
  const stmt = ledgerDb.prepare('DELETE FROM snapshot_totals_cache');
  const result = stmt.run();

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
  // Clear snapshot totals cache so they get recalculated with correct values
  // (real estate equity included, mortgages excluded from liabilities to prevent double-counting)
  const cacheResult = clearSnapshotTotalsCache(ledgerDb);

  return {
    snapshots: cacheResult,
  };
}
