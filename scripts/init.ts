#!/usr/bin/env tsx

import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { DatabaseManager } from '../src/database/connection.js';
import { LedgerRepository } from '../src/database/ledger.js';
import { configManager } from '../src/utils/config.js';

const COMMON_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', cmc_id: 1 },
  { symbol: 'ETH', name: 'Ethereum', cmc_id: 1027 },
  { symbol: 'BNB', name: 'BNB', cmc_id: 1839 },
  { symbol: 'SOL', name: 'Solana', cmc_id: 5426 },
  { symbol: 'XRP', name: 'XRP', cmc_id: 52 },
  { symbol: 'ADA', name: 'Cardano', cmc_id: 2010 },
  { symbol: 'AVAX', name: 'Avalanche', cmc_id: 5805 },
  { symbol: 'DOT', name: 'Polkadot', cmc_id: 6636 },
  { symbol: 'MATIC', name: 'Polygon', cmc_id: 3890 },
  { symbol: 'LINK', name: 'Chainlink', cmc_id: 1975 },
  { symbol: 'UNI', name: 'Uniswap', cmc_id: 7083 },
  { symbol: 'ATOM', name: 'Cosmos', cmc_id: 3794 },
  { symbol: 'LTC', name: 'Litecoin', cmc_id: 2 },
  { symbol: 'XLM', name: 'Stellar', cmc_id: 512 },
  { symbol: 'ALGO', name: 'Algorand', cmc_id: 4030 },
];

async function init() {
  console.log(pc.bold('\n🚀 Initializing Crypto Tracker\n'));

  // Step 1: Create data directory
  const spinner = clack.spinner();
  spinner.start('Creating data directory...');
  const dataDir = join(process.cwd(), 'data');

  try {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
      spinner.stop('Data directory created');
    } else {
      spinner.stop('Data directory already exists');
    }
  } catch (error) {
    spinner.stop('Failed to create data directory');
    console.error(error);
    process.exit(1);
  }

  // Step 2: Initialize configuration
  spinner.start('Initializing configuration...');
  try {
    configManager.initializeDefaults();
    spinner.stop('Configuration initialized');

    console.log(pc.gray(`  Config file: ${configManager.getPath()}`));

    const isConfigured = configManager.isConfigured();
    if (!isConfigured) {
      clack.log.warn('API keys not configured');
      console.log(
        pc.yellow(
          '\n⚠️  Please set your API keys in one of the following ways:\n'
        )
      );
      console.log('  1. Set environment variables:');
      console.log(pc.gray('     export CMC_API_KEY=your_coinmarketcap_key'));
      console.log(pc.gray('     export ANTHROPIC_API_KEY=your_anthropic_key'));
      console.log('\n  2. Or edit the config file directly:');
      console.log(pc.gray(`     ${configManager.getPath()}\n`));
    }
  } catch (error) {
    spinner.stop('Failed to initialize configuration');
    console.error(error);
    process.exit(1);
  }

  // Step 3: Initialize databases
  spinner.start('Initializing databases...');
  try {
    const config = configManager.get();

    const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
    const ratesDb = DatabaseManager.getRatesDb(config.database.ratesPath);

    spinner.stop('Databases initialized');
    console.log(pc.gray(`  Ledger DB: ${config.database.ledgerPath}`));
    console.log(pc.gray(`  Rates DB: ${config.database.ratesPath}`));
  } catch (error) {
    spinner.stop('Failed to initialize databases');
    console.error(error);
    process.exit(1);
  }

  // Step 4: Seed common crypto assets
  spinner.start('Seeding common crypto assets...');
  try {
    const config = configManager.get();
    const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
    const ledgerRepo = new LedgerRepository(ledgerDb);

    let added = 0;
    let existing = 0;

    for (const asset of COMMON_ASSETS) {
      const existingAsset = ledgerRepo.getAsset(asset.symbol);
      if (!existingAsset) {
        ledgerRepo.createAsset(asset);
        added++;
      } else {
        existing++;
      }
    }

    spinner.stop(`Seeded ${added} new assets (${existing} already existed)`);
  } catch (error) {
    spinner.stop('Failed to seed assets');
    console.error(error);
    process.exit(1);
  }

  // Step 5: Cleanup
  DatabaseManager.closeAll();

  console.log(pc.green('\n✓ Crypto Tracker initialized successfully!\n'));
  console.log('Next steps:');
  console.log(pc.gray('  1. Configure your API keys (see above)'));
  console.log(pc.gray('  2. Add your first snapshot: npm run dev snapshot add'));
  console.log(
    pc.gray('  3. Query your portfolio: npm run dev query "How much BTC do I have?"\n')
  );
}

init().catch((error) => {
  clack.log.error('\n✗ Initialization failed:');
  console.error(error);
  process.exit(1);
});
