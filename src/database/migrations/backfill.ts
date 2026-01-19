import type Database from 'better-sqlite3';
import { Logger } from '../../utils/logger.js';

export interface BackfillResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface HoldingRow {
  id: number;
  asset_id: number;
  snapshot_id: number;
  amount: number;
}

interface SnapshotRow {
  id: number;
  date: string;
}

interface AssetRow {
  id: number;
  symbol: string;
}

interface RateRow {
  price: number;
}

/**
 * Backfills value_eur for all holdings using historical rates
 */
export async function backfillHoldingValues(
  ledgerDb: Database.Database,
  ratesDb: Database.Database
): Promise<BackfillResult> {
  const result: BackfillResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Get all holdings that need value_eur populated
  const holdings = ledgerDb
    .prepare(
      `SELECT h.id, h.asset_id, h.snapshot_id, h.amount
       FROM holdings h
       WHERE h.value_eur IS NULL`
    )
    .all() as HoldingRow[];

  if (holdings.length === 0) {
    Logger.info('No holdings need value backfill');
    return result;
  }

  Logger.info(`Backfilling values for ${holdings.length} holdings...`);

  // Build lookup maps for efficiency
  const snapshotDates = new Map<number, string>();
  const snapshots = ledgerDb.prepare('SELECT id, date FROM snapshots').all() as SnapshotRow[];
  for (const s of snapshots) {
    snapshotDates.set(s.id, s.date);
  }

  const assetSymbols = new Map<number, string>();
  const assets = ledgerDb.prepare('SELECT id, symbol FROM assets').all() as AssetRow[];
  for (const a of assets) {
    assetSymbols.set(a.id, a.symbol);
  }

  // Prepare update statement
  const updateHolding = ledgerDb.prepare(
    'UPDATE holdings SET value_eur = ? WHERE id = ?'
  );

  // Process each holding
  for (const holding of holdings) {
    result.processed++;

    const date = snapshotDates.get(holding.snapshot_id);
    const symbol = assetSymbols.get(holding.asset_id);

    if (!date || !symbol) {
      result.skipped++;
      result.errors.push(`Holding ${holding.id}: missing snapshot date or asset symbol`);
      continue;
    }

    // Query historical rates - find closest rate to the snapshot date
    const rate = ratesDb
      .prepare(
        `SELECT price FROM historical_rates
         WHERE asset_symbol = ? AND base_currency = 'EUR'
         AND date(timestamp) <= date(?)
         ORDER BY timestamp DESC
         LIMIT 1`
      )
      .get(symbol, date) as RateRow | undefined;

    if (!rate) {
      result.skipped++;
      // Don't log every missing rate - just count them
      continue;
    }

    const valueEur = holding.amount * rate.price;
    updateHolding.run(valueEur, holding.id);
    result.updated++;
  }

  Logger.info(
    `Backfill complete: ${result.updated} updated, ${result.skipped} skipped (missing rates)`
  );

  return result;
}

/**
 * Backfills snapshot totals (total_assets_eur, net_worth_eur) from holdings
 */
export async function backfillSnapshotTotals(
  ledgerDb: Database.Database
): Promise<BackfillResult> {
  const result: BackfillResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Get all snapshots that need totals calculated
  const snapshots = ledgerDb
    .prepare(
      `SELECT id, date FROM snapshots
       WHERE total_assets_eur IS NULL`
    )
    .all() as SnapshotRow[];

  if (snapshots.length === 0) {
    Logger.info('No snapshots need totals backfill');
    return result;
  }

  Logger.info(`Backfilling totals for ${snapshots.length} snapshots...`);

  // Prepare statements
  const sumHoldings = ledgerDb.prepare(
    `SELECT COALESCE(SUM(value_eur), 0) as total
     FROM holdings
     WHERE snapshot_id = ?`
  );

  const sumLiabilities = ledgerDb.prepare(
    `SELECT COALESCE(SUM(value_eur), 0) as total
     FROM liability_balances
     WHERE snapshot_id = ?`
  );

  const updateSnapshot = ledgerDb.prepare(
    `UPDATE snapshots
     SET total_assets_eur = ?,
         total_liabilities_eur = ?,
         net_worth_eur = ?
     WHERE id = ?`
  );

  // Process each snapshot
  for (const snapshot of snapshots) {
    result.processed++;

    const assetsResult = sumHoldings.get(snapshot.id) as { total: number };
    const liabilitiesResult = sumLiabilities.get(snapshot.id) as { total: number };

    const totalAssets = assetsResult.total || 0;
    const totalLiabilities = liabilitiesResult.total || 0;
    const netWorth = totalAssets - totalLiabilities;

    updateSnapshot.run(totalAssets, totalLiabilities, netWorth, snapshot.id);
    result.updated++;
  }

  Logger.info(`Snapshot totals backfill complete: ${result.updated} updated`);

  return result;
}

/**
 * Runs all backfill operations after schema migration
 */
export async function runAllBackfills(
  ledgerDb: Database.Database,
  ratesDb: Database.Database
): Promise<{
  holdings: BackfillResult;
  snapshots: BackfillResult;
}> {
  Logger.info('Starting backfill operations...');

  // First backfill holding values (needs rates)
  const holdingsResult = await backfillHoldingValues(ledgerDb, ratesDb);

  // Then backfill snapshot totals (needs holding values)
  const snapshotsResult = await backfillSnapshotTotals(ledgerDb);

  Logger.success('All backfill operations complete');

  return {
    holdings: holdingsResult,
    snapshots: snapshotsResult,
  };
}
