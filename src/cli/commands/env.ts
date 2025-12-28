import { Command } from 'commander';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DatabaseManager } from '../../database/connection.js';
import { configManager } from '../../utils/config.js';
import { Logger } from '../../utils/logger.js';
import { getCurrentEnvironment } from '../index.js';

export const envCommand = new Command('env')
  .description('Environment management commands')
  .addCommand(
    new Command('seed-dev')
      .description('Copy production data to development environment')
      .option('--force', 'Overwrite existing dev data without confirmation')
      .action(seedDevFromProd)
  )
  .addCommand(new Command('current').description('Show current environment').action(showCurrentEnvironment));

async function seedDevFromProd(options: { force?: boolean }) {
  clack.intro('Seed Development Environment');

  try {
    const prodLedger = join(process.cwd(), 'data', 'prod', 'ledger.db');
    const prodRates = join(process.cwd(), 'data', 'prod', 'rates.db');
    const devLedger = join(process.cwd(), 'data', 'dev', 'ledger.db');
    const devRates = join(process.cwd(), 'data', 'dev', 'rates.db');

    // Safety checks
    if (!existsSync(prodLedger) || !existsSync(prodRates)) {
      Logger.error('Production databases not found. Nothing to copy.');
      clack.outro('Operation cancelled');
      process.exit(1);
    }

    // Check if dev data exists
    const devExists = existsSync(devLedger) || existsSync(devRates);
    if (devExists && !options.force) {
      console.log(pc.yellow('\nDevelopment environment already has data.'));
      const confirm = await clack.confirm({
        message: 'Overwrite existing development data with production data?',
        initialValue: false,
      });

      if (clack.isCancel(confirm) || !confirm) {
        clack.cancel('Operation cancelled');
        process.exit(0);
      }
    }

    // Ensure dev directory exists
    const devDir = join(process.cwd(), 'data', 'dev');
    if (!existsSync(devDir)) {
      mkdirSync(devDir, { recursive: true });
    }

    // Close any open database connections
    DatabaseManager.closeAll();

    // Copy files
    const spinner = clack.spinner();
    spinner.start('Copying production data to development...');

    copyFileSync(prodLedger, devLedger);
    copyFileSync(prodRates, devRates);

    spinner.stop(pc.green('Data copied successfully'));

    console.log(pc.cyan(`\nCopied:`));
    console.log(pc.cyan(`  ${prodLedger} → ${devLedger}`));
    console.log(pc.cyan(`  ${prodRates} → ${devRates}`));

    clack.outro('Development environment seeded successfully!');
  } catch (error) {
    Logger.error(`Failed to seed development: ${error instanceof Error ? error.message : String(error)}`);
    clack.outro('Seeding failed');
    process.exit(1);
  }
}

async function showCurrentEnvironment() {
  const env = getCurrentEnvironment();
  const config = configManager.getWithEnvironment(env);

  console.log(pc.bold(`\nCurrent Environment: ${pc.cyan(config.environment)}`));
  console.log(pc.cyan(`Ledger DB: ${config.database.ledgerPath}`));
  console.log(pc.cyan(`Rates DB: ${config.database.ratesPath}\n`));
}
