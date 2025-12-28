#!/usr/bin/env tsx
import { existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
async function migrate() {
    clack.intro(pc.bold('Migrate to Environment-based Structure'));
    const dataDir = join(process.cwd(), 'data');
    const oldLedger = join(dataDir, 'ledger.db');
    const oldRates = join(dataDir, 'rates.db');
    // Check if old structure exists
    const hasOldLedger = existsSync(oldLedger);
    const hasOldRates = existsSync(oldRates);
    if (!hasOldLedger && !hasOldRates) {
        console.log(pc.cyan('\nNo existing databases found in data/ directory.'));
        console.log(pc.gray('Nothing to migrate.'));
        clack.outro('Migration not needed');
        return;
    }
    console.log(pc.yellow('\nThis will move existing data to the prod environment:'));
    if (hasOldLedger) {
        console.log(pc.cyan(`  data/ledger.db → data/prod/ledger.db`));
    }
    if (hasOldRates) {
        console.log(pc.cyan(`  data/rates.db → data/prod/rates.db`));
    }
    const koinlyDir = join(dataDir, 'koinly_snapshots');
    if (existsSync(koinlyDir)) {
        console.log(pc.cyan(`  data/koinly_snapshots/ → data/prod/koinly_snapshots/`));
    }
    const confirm = await clack.confirm({
        message: 'Proceed with migration?',
        initialValue: true,
    });
    if (clack.isCancel(confirm) || !confirm) {
        clack.cancel('Migration cancelled');
        process.exit(0);
    }
    const spinner = clack.spinner();
    spinner.start('Migrating databases...');
    try {
        // Create prod directory
        const prodDir = join(dataDir, 'prod');
        if (!existsSync(prodDir)) {
            mkdirSync(prodDir, { recursive: true });
        }
        // Create dev directory
        const devDir = join(dataDir, 'dev');
        if (!existsSync(devDir)) {
            mkdirSync(devDir, { recursive: true });
        }
        // Move files
        if (hasOldLedger) {
            renameSync(oldLedger, join(prodDir, 'ledger.db'));
        }
        if (hasOldRates) {
            renameSync(oldRates, join(prodDir, 'rates.db'));
        }
        // Preserve koinly_snapshots if it exists
        if (existsSync(koinlyDir)) {
            renameSync(koinlyDir, join(prodDir, 'koinly_snapshots'));
        }
        spinner.stop(pc.green('Migration complete'));
        console.log(pc.green('\n✓ Databases migrated to prod environment'));
        console.log(pc.cyan('\nNext steps:'));
        console.log(pc.cyan('  1. Run with prod: npm run dev -- --env prod snapshot list'));
        console.log(pc.cyan('  2. Seed dev environment: npm run dev env seed-dev\n'));
        clack.outro('Migration successful!');
    }
    catch (error) {
        spinner.stop(pc.red('Migration failed'));
        console.error(pc.red(`Migration error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
}
migrate();
//# sourceMappingURL=migrate-to-env-structure.js.map