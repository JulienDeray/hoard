import { Command } from 'commander';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'fs';
import Database from 'better-sqlite3';
import { DatabaseManager } from '../../database/connection.js';
import { MigrationRunner } from '../../database/migrations/runner.js';
import { runAllBackfills } from '../../database/migrations/backfill.js';
import { configManager } from '../../utils/config.js';
import { Logger } from '../../utils/logger.js';
import { getCurrentEnvironment } from '../index.js';

export const migrateCommand = new Command('migrate')
  .description('Run database migrations')
  .option('--dry-run', 'Preview migrations without applying them')
  .option('--status', 'Show current migration status')
  .option('--backfill', 'Run backfill operations only (after migration)')
  .action(runMigrate);

async function runMigrate(options: { dryRun?: boolean; status?: boolean; backfill?: boolean }) {
  const env = getCurrentEnvironment();
  const config = configManager.getWithEnvironment(env);

  clack.intro(`Database Migration (${pc.cyan(env)} environment)`);

  try {
    // Check if database files exist
    const ledgerExists = existsSync(config.database.ledgerPath);
    const ratesExists = existsSync(config.database.ratesPath);

    if (!ledgerExists) {
      Logger.info(`Ledger database will be created at: ${pc.cyan(config.database.ledgerPath)}`);
    }
    if (!ratesExists) {
      Logger.info(`Rates database will be created at: ${pc.cyan(config.database.ratesPath)}`);
    }

    // Open databases without auto-migration (we handle it manually)
    const ledgerDb = new Database(config.database.ledgerPath);
    ledgerDb.pragma('foreign_keys = ON');

    const ratesDb = new Database(config.database.ratesPath);

    const runner = new MigrationRunner(ledgerDb, ratesDb, config.database.ledgerPath);

    // Status mode
    if (options.status) {
      await showStatus(runner);
      ledgerDb.close();
      ratesDb.close();
      clack.outro('Status check complete');
      return;
    }

    // Backfill only mode
    if (options.backfill) {
      await runBackfillOnly(ledgerDb, ratesDb);
      ledgerDb.close();
      ratesDb.close();
      clack.outro('Backfill complete');
      return;
    }

    // Get pending migrations
    const status = runner.getStatus();

    console.log(pc.bold('\nCurrent Status:'));
    console.log(`  Schema version: ${pc.cyan(status.currentVersion.toString())}`);
    console.log(`  Pending migrations: ${pc.cyan(status.pendingMigrations.length.toString())}`);

    if (status.pendingMigrations.length === 0) {
      Logger.info('Database is up to date');
      ledgerDb.close();
      ratesDb.close();
      clack.outro('No migrations needed');
      return;
    }

    // Show pending migrations
    console.log(pc.bold('\nPending Migrations:'));
    for (const migration of status.pendingMigrations) {
      console.log(`  v${migration.version}: ${pc.cyan(migration.description)}`);
    }
    console.log();

    // Dry run mode
    if (options.dryRun) {
      Logger.info('Running in dry-run mode - no changes will be made');
      const results = await runner.runAll(true);

      console.log(pc.bold('\n[DRY RUN] Results:'));
      for (const result of results) {
        if (result.success) {
          console.log(`  ${pc.green('✓')} v${result.version}: ${result.description}`);
        } else {
          console.log(`  ${pc.red('✗')} v${result.version}: ${result.error}`);
        }
      }

      ledgerDb.close();
      ratesDb.close();
      clack.outro('Dry run complete - no changes made');
      return;
    }

    // Confirm before running
    const confirm = await clack.confirm({
      message: `Run ${status.pendingMigrations.length} migration(s)?`,
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel('Migration cancelled');
      ledgerDb.close();
      ratesDb.close();
      process.exit(0);
    }

    // Create backup before migration
    const spinner = clack.spinner();
    spinner.start('Creating backup...');

    let backupPath: string | null = null;
    if (ledgerExists) {
      backupPath = runner.createBackup();
      spinner.stop(`Backup created: ${pc.cyan(backupPath)}`);
    } else {
      spinner.stop('No backup needed (new database)');
    }

    // Run migrations
    spinner.start('Running migrations...');
    const results = await runner.runAll(false);
    spinner.stop('Migrations complete');

    // Show results
    console.log(pc.bold('\nMigration Results:'));
    let allSuccessful = true;
    for (const result of results) {
      if (result.success) {
        console.log(`  ${pc.green('✓')} v${result.version}: ${result.description} (${result.duration}ms)`);
      } else {
        console.log(`  ${pc.red('✗')} v${result.version}: ${result.error}`);
        allSuccessful = false;
      }
    }

    if (!allSuccessful) {
      Logger.error('Some migrations failed');
      if (backupPath) {
        Logger.info(`You can restore from backup: ${backupPath}`);
      }
      ledgerDb.close();
      ratesDb.close();
      clack.outro('Migration failed');
      process.exit(1);
    }

    // Ask about backfill
    const doBackfill = await clack.confirm({
      message: 'Run backfill operations to populate computed values?',
      initialValue: true,
    });

    if (!clack.isCancel(doBackfill) && doBackfill) {
      await runBackfillOnly(ledgerDb, ratesDb);
    }

    ledgerDb.close();
    ratesDb.close();

    const newStatus = runner.getStatus();
    clack.outro(`Migration complete. Schema version: ${newStatus.currentVersion}`);
  } catch (error) {
    Logger.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    DatabaseManager.closeAll();
    clack.outro('Migration failed');
    process.exit(1);
  }
}

async function showStatus(runner: MigrationRunner): Promise<void> {
  const status = runner.getStatus();

  console.log(pc.bold('\nSchema Version Information:'));
  console.log(`  Current version: ${pc.cyan(status.currentVersion.toString())}`);
  console.log();

  if (status.appliedMigrations.length > 0) {
    console.log(pc.bold('Applied Migrations:'));
    for (const migration of status.appliedMigrations) {
      console.log(`  ${pc.green('✓')} v${migration.version}: ${migration.description}`);
      console.log(`    Applied at: ${pc.cyan(migration.applied_at)}`);
    }
    console.log();
  }

  if (status.pendingMigrations.length > 0) {
    console.log(pc.bold('Pending Migrations:'));
    for (const migration of status.pendingMigrations) {
      console.log(`  ${pc.yellow('○')} v${migration.version}: ${migration.description}`);
    }
  } else {
    console.log(pc.green('Database is up to date'));
  }
}

async function runBackfillOnly(
  ledgerDb: Database.Database,
  ratesDb: Database.Database
): Promise<void> {
  const spinner = clack.spinner();
  spinner.start('Running backfill operations...');

  const results = await runAllBackfills(ledgerDb, ratesDb);

  spinner.stop('Backfill complete');

  console.log(pc.bold('\nBackfill Results:'));
  console.log(`  Holdings: ${pc.cyan(results.holdings.updated.toString())} updated, ${pc.cyan(results.holdings.skipped.toString())} skipped`);
  console.log(`  Snapshots: ${pc.cyan(results.snapshots.updated.toString())} updated`);

  if (results.holdings.errors.length > 0) {
    console.log(pc.yellow(`\n  Warnings (first 5):`));
    results.holdings.errors.slice(0, 5).forEach((err) => {
      console.log(`    - ${err}`);
    });
  }
}
