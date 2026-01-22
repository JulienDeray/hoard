#!/usr/bin/env tsx
/**
 * Database Migration Script
 *
 * Non-interactive migration runner for CI/CD and command-line use.
 *
 * Usage:
 *   npm run migrate              # Run migrations on dev environment
 *   npm run migrate -- --env=prod  # Run migrations on prod environment
 *   npm run migrate -- --dry-run   # Preview migrations without applying
 *   npm run migrate -- --status    # Show current schema version
 *   npm run migrate -- --backfill  # Run data backfill operations
 */

import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseManager } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrations/runner.js';
import { runAllBackfills } from '../src/database/migrations/backfill.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Parse command line arguments
function parseArgs(): { env: 'dev' | 'prod'; dryRun: boolean; status: boolean; backfill: boolean } {
  const args = process.argv.slice(2);
  let env: 'dev' | 'prod' = 'dev';
  let dryRun = false;
  let status = false;
  let backfill = false;

  for (const arg of args) {
    if (arg === '--env=prod' || arg === '--env prod') {
      env = 'prod';
    } else if (arg === '--env=dev' || arg === '--env dev') {
      env = 'dev';
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--status') {
      status = true;
    } else if (arg === '--backfill') {
      backfill = true;
    }
  }

  return { env, dryRun, status, backfill };
}

async function main() {
  const { env, dryRun, status, backfill } = parseArgs();

  const dataDir = join(projectRoot, 'data', env);
  const ledgerPath = join(dataDir, 'ledger.db');
  const ratesPath = join(dataDir, 'rates.db');

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  console.log(`Environment: ${env.toUpperCase()}`);
  console.log(`Ledger DB: ${ledgerPath}`);
  console.log(`Rates DB: ${ratesPath}`);
  console.log('');

  try {
    // Initialize databases
    const ledgerDb = DatabaseManager.getLedgerDb(ledgerPath);
    const ratesDb = DatabaseManager.getRatesDb(ratesPath);

    const runner = new MigrationRunner(ledgerDb, ratesDb, ledgerPath);

    if (status) {
      // Show status only
      const statusInfo = runner.getStatus();
      console.log(`Current schema version: ${statusInfo.currentVersion}`);
      console.log('');

      if (statusInfo.appliedMigrations.length > 0) {
        console.log('Applied migrations:');
        for (const m of statusInfo.appliedMigrations) {
          console.log(`  v${m.version}: ${m.description} (${m.applied_at})`);
        }
      }

      if (statusInfo.pendingMigrations.length > 0) {
        console.log('');
        console.log('Pending migrations:');
        for (const m of statusInfo.pendingMigrations) {
          console.log(`  v${m.version}: ${m.description}`);
        }
      } else {
        console.log('');
        console.log('No pending migrations');
      }

      DatabaseManager.closeAll();
      return;
    }

    if (backfill) {
      // Run backfill operations
      console.log('Running backfill operations...');
      const result = await runAllBackfills(ledgerDb);
      console.log(`Backfill complete: ${result.snapshots.processed} items processed`);
      DatabaseManager.closeAll();
      return;
    }

    // Check for pending migrations
    const pending = runner.getPendingMigrations();

    if (pending.length === 0) {
      console.log('No pending migrations');
      DatabaseManager.closeAll();
      return;
    }

    console.log(`Found ${pending.length} pending migration(s):`);
    for (const m of pending) {
      console.log(`  v${m.version}: ${m.description}`);
    }
    console.log('');

    if (dryRun) {
      console.log('[DRY RUN] Would apply the above migrations');
      DatabaseManager.closeAll();
      return;
    }

    // Create backup before migration
    const backupPath = runner.createBackup();
    console.log(`Backup created: ${backupPath}`);
    console.log('');

    // Run migrations
    console.log('Running migrations...');
    const results = await runner.runAll(false);

    // Report results
    let hasErrors = false;
    for (const result of results) {
      if (result.success) {
        console.log(`  v${result.version}: ${result.description} - OK (${result.duration}ms)`);
      } else {
        console.error(`  v${result.version}: ${result.description} - FAILED: ${result.error}`);
        hasErrors = true;
      }
    }

    console.log('');
    if (hasErrors) {
      console.error('Migration completed with errors');
      process.exit(1);
    } else {
      console.log('All migrations completed successfully');
    }

    DatabaseManager.closeAll();
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : String(error));
    DatabaseManager.closeAll();
    process.exit(1);
  }
}

main();
