import { Command } from 'commander';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { format } from 'date-fns';
import { DatabaseManager } from '../../database/connection.js';
import { LedgerRepository } from '../../database/ledger.js';
import { RatesRepository } from '../../database/rates.js';
import { CoinMarketCapService } from '../../services/coinmarketcap.js';
import { PortfolioService } from '../../services/portfolio.js';
import { AllocationService } from '../../services/allocation.js';
import { SnapshotService } from '../../services/snapshot.js';
import { configManager } from '../../utils/config.js';
import { Logger } from '../../utils/logger.js';
import { validateDate } from '../../utils/validators.js';
import { formatEuro } from '../../utils/formatters.js';
import { getCurrentEnvironment } from '../index.js';
import {
  ServiceError,
  SnapshotNotFoundError,
  SnapshotAlreadyExistsError,
  HoldingNotFoundError,
  InvalidDateError,
} from '../../errors/index.js';
import type { Asset, HoldingWithAsset } from '../../models/index.js';

export const snapshotCommand = new Command('snapshot')
  .description('Manage portfolio snapshots')
  .addCommand(
    new Command('add')
      .description('Add a new portfolio snapshot')
      .action(addSnapshot)
  )
  .addCommand(
    new Command('list')
      .description('List all snapshots')
      .option('--assets <symbols>', 'Comma-separated list of asset symbols to display (e.g., BTC,ETH,SOL)')
      .option('--last <n>', 'Show only the last N snapshots', parseInt)
      .action(listSnapshots)
  )
  .addCommand(
    new Command('view')
      .description('View a specific snapshot')
      .argument('<date>', 'Snapshot date (YYYY-MM-DD)')
      .action(viewSnapshot)
  )
  .addCommand(
    new Command('delete')
      .description('Delete a snapshot or specific holding')
      .argument('<date>', 'Snapshot date (YYYY-MM-DD)')
      .argument('[asset-symbol]', 'Optional: Asset symbol to delete (e.g., BTC)')
      .action(deleteSnapshot)
  );

// ============================================================================
// Helper: Initialize services
// ============================================================================

function initializeServices() {
  const env = getCurrentEnvironment();
  const config = configManager.getWithEnvironment(env);
  const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
  const ratesDb = DatabaseManager.getRatesDb(config.database.ratesPath);
  const ledgerRepo = new LedgerRepository(ledgerDb);
  const ratesRepo = new RatesRepository(ratesDb, config.cache.rateCacheTTL);
  const cmcService = new CoinMarketCapService(config.api.coinmarketcap.apiKey);

  const snapshotService = new SnapshotService(
    ledgerRepo,
    ratesRepo,
    cmcService,
    config.defaults.baseCurrency
  );

  const portfolioService = new PortfolioService(
    ledgerRepo,
    ratesRepo,
    cmcService,
    config.defaults.baseCurrency
  );

  const allocationService = new AllocationService(ledgerRepo, portfolioService);

  return {
    config,
    ledgerRepo,
    ratesRepo,
    cmcService,
    snapshotService,
    portfolioService,
    allocationService,
  };
}

// ============================================================================
// Helper: Handle service errors
// ============================================================================

function handleSnapshotError(error: unknown): never {
  if (error instanceof SnapshotNotFoundError) {
    Logger.error(`No snapshot found for ${error.date}`);
    DatabaseManager.closeAll();
    clack.outro('Snapshot not found');
    process.exit(1);
  }

  if (error instanceof SnapshotAlreadyExistsError) {
    Logger.error(`Snapshot already exists for ${error.date}`);
    DatabaseManager.closeAll();
    clack.outro('Snapshot already exists');
    process.exit(1);
  }

  if (error instanceof HoldingNotFoundError) {
    Logger.error(`Asset ${error.symbol} not found in snapshot ${error.snapshotDate}`);
    DatabaseManager.closeAll();
    clack.outro('Asset not found');
    process.exit(1);
  }

  if (error instanceof InvalidDateError) {
    Logger.error('Invalid date format. Use YYYY-MM-DD');
    DatabaseManager.closeAll();
    clack.outro('Invalid date format');
    process.exit(1);
  }

  if (error instanceof ServiceError) {
    Logger.error(error.message);
    DatabaseManager.closeAll();
    clack.outro('Operation failed');
    process.exit(1);
  }

  // Unknown error
  Logger.error(error instanceof Error ? error.message : String(error));
  DatabaseManager.closeAll();
  process.exit(1);
}

// ============================================================================
// CLI Commands
// ============================================================================

async function listSnapshots(options: { assets?: string; last?: number }) {
  clack.intro('Portfolio Snapshots');

  try {
    const { snapshotService } = initializeServices();

    const result = snapshotService.listSnapshots({
      assets: options.assets,
      last: options.last,
    });

    if (result.snapshots.length === 0) {
      Logger.info('No snapshots found');
      DatabaseManager.closeAll();
      clack.outro('No snapshots to display');
      return;
    }

    // Check if asset filter produced no matches
    if (options.assets && result.filteredAssetSymbols.length === 0) {
      Logger.error('None of the requested assets were found in the snapshots');
      DatabaseManager.closeAll();
      clack.outro('No matching assets found');
      return;
    }

    // Display snapshots
    console.log(pc.bold(`\nPortfolio Snapshots:\n`));

    // Show filter info if filters are applied
    if (options.assets || options.last) {
      const filters: string[] = [];
      if (options.assets) filters.push(`assets: ${result.filteredAssetSymbols.join(', ')}`);
      if (options.last) filters.push(`last ${options.last} snapshot(s)`);
      console.log(pc.cyan(`Filters: ${filters.join(', ')}\n`));
    }

    // Header row
    const dateColWidth = 12;
    const assetColWidth = 15;
    let header = 'Date'.padEnd(dateColWidth);
    result.filteredAssetSymbols.forEach((symbol) => {
      header += symbol.padEnd(assetColWidth);
    });
    console.log(pc.bold(header));
    console.log('─'.repeat(dateColWidth + result.filteredAssetSymbols.length * assetColWidth));

    // Data rows
    for (const { snapshot, holdingsMap } of result.snapshots) {
      let row = snapshot.date.padEnd(dateColWidth);
      result.filteredAssetSymbols.forEach((symbol) => {
        const amount = holdingsMap.get(symbol);
        const value = amount !== undefined ? amount.toString() : '─';
        row += value.padEnd(assetColWidth);
      });
      console.log(row);
    }

    console.log();

    DatabaseManager.closeAll();
    const filterInfo = result.snapshots.length < result.totalCount
      ? ` (${result.snapshots.length} of ${result.totalCount} total)`
      : '';
    clack.outro(`Found ${result.snapshots.length} snapshot(s)${filterInfo}`);
  } catch (error) {
    handleSnapshotError(error);
  }
}

async function viewSnapshot(date: string) {
  clack.intro(`View Snapshot: ${date}`);

  try {
    const { snapshotService, portfolioService, allocationService } = initializeServices();

    // Get snapshot with holdings using service
    const { snapshot } = snapshotService.getSnapshotByDate(date);

    console.log(pc.bold(`\nSnapshot: ${snapshot.date}\n`));
    if (snapshot.notes) {
      console.log(pc.cyan(`Notes: ${snapshot.notes}\n`));
    }

    // Get enriched portfolio data
    const summary = await portfolioService.getPortfolioValue(date);

    if (!summary || summary.holdings.length === 0) {
      Logger.info('No holdings in this snapshot');
      DatabaseManager.closeAll();
      clack.outro('No holdings to display');
      return;
    }

    // Display holdings
    console.log(pc.bold('Holdings:'));
    for (const holding of summary.holdings) {
      const priceStr = holding.current_price_eur
        ? formatEuro(holding.current_price_eur)
        : 'N/A';
      const valueStr = holding.current_value_eur
        ? formatEuro(holding.current_value_eur)
        : 'N/A';

      console.log(`  ${pc.bold(holding.asset_symbol)} (${holding.asset_name})`);
      console.log(
        `    ${holding.amount} ${holding.asset_symbol}` +
          pc.bold(' = ') +
          pc.green(valueStr) +
          pc.cyan(` (@ ${priceStr})`)
      );
      console.log();
    }

    // Show allocation comparison if targets exist
    const allocationSummary = await allocationService.getAllocationSummary(date);

    if (allocationSummary && allocationSummary.has_targets) {
      console.log(pc.bold('Allocation vs Targets:'));

      if (!allocationSummary.targets_sum_valid) {
        console.log(pc.yellow('  ⚠ Warning: Targets do not sum to 100%'));
      }

      for (const alloc of allocationSummary.allocations) {
        const arrow = alloc.is_within_tolerance
          ? pc.green('✓')
          : alloc.difference_percentage > 0
            ? pc.red('▲')
            : pc.yellow('▼');

        console.log(
          `  ${arrow} ${pc.bold(alloc.target_key)}: ` +
            `${alloc.current_percentage.toFixed(1)}% (target: ${alloc.target_percentage.toFixed(1)}%)`
        );
      }
      console.log();
    }

    // Total value
    if (summary.totalValue) {
      console.log(
        pc.bold(`Total Value: ${pc.green(formatEuro(summary.totalValue))}\n`)
      );
    }

    // Show snapshot totals if available
    if (snapshot.net_worth_eur !== undefined && snapshot.net_worth_eur !== null) {
      console.log(pc.cyan(`Net Worth (cached): ${formatEuro(snapshot.net_worth_eur)}`));
    }

    DatabaseManager.closeAll();
    clack.outro(`Snapshot loaded: ${summary.holdings.length} holding(s)`);
  } catch (error) {
    handleSnapshotError(error);
  }
}

async function addSnapshot() {
  clack.intro('Add Portfolio Snapshot');

  try {
    const { snapshotService, portfolioService } = initializeServices();

    // Prompt for snapshot date
    const date = await clack.text({
      message: 'Enter snapshot date (YYYY-MM-DD):',
      placeholder: format(new Date(), 'yyyy-MM-dd'),
      defaultValue: format(new Date(), 'yyyy-MM-dd'),
      validate: (input: string) => {
        if (!validateDate(input)) {
          return 'Please enter a valid date in YYYY-MM-DD format';
        }
        return undefined;
      },
    });

    if (clack.isCancel(date)) {
      clack.cancel('Operation cancelled');
      DatabaseManager.closeAll();
      process.exit(0);
    }

    // Check if snapshot already exists
    const existsResult = snapshotService.checkSnapshotExists(date);

    let snapshot;
    if (existsResult.exists && existsResult.snapshot) {
      // Snapshot exists, ask if user wants to add to it
      console.log(pc.yellow(`\nSnapshot already exists for ${date}`));
      console.log(pc.cyan(`Current holdings: ${existsResult.holdings.length} asset(s)`));

      const addToExisting = await clack.confirm({
        message: 'Add more holdings to this snapshot?',
        initialValue: true,
      });

      if (clack.isCancel(addToExisting) || !addToExisting) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

      snapshot = existsResult.snapshot;
      Logger.info(`Adding holdings to existing snapshot for ${date}`);
    } else {
      // Create new snapshot
      const notes = await clack.text({
        message: 'Notes (optional):',
        defaultValue: '',
      });

      if (clack.isCancel(notes)) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

      const result = snapshotService.getOrCreateSnapshot(date, notes || undefined);
      snapshot = result.snapshot;
      Logger.success(`Snapshot created for ${date}`);
    }

    console.log(pc.bold('\nAdding holdings to snapshot...\n'));

    // Get available assets and existing holdings
    const assets = snapshotService.listAssets();
    const existingHoldings = snapshotService.getHoldingsBySnapshotId(snapshot.id);
    const existingSymbols = new Set(existingHoldings.map((h) => h.asset_symbol));

    // Show existing holdings if any
    if (existingHoldings.length > 0) {
      console.log(pc.cyan('Existing holdings:'));
      existingHoldings.forEach((h) => {
        console.log(pc.cyan(`  - ${h.asset_symbol}: ${h.amount}`));
      });
      console.log();
    }

    const holdings: Array<{ asset: Asset; amount: number }> = [];

    while (true) {
      const symbolInput = await clack.text({
        message: 'Asset symbol (press enter to finish):',
        placeholder: 'BTC, ETH, SOL...',
        defaultValue: '',
        validate: (input: string) => {
          if (!input) return undefined; // Allow empty to finish
          if (input.length > 10) {
            return 'Symbol too long (max 10 characters)';
          }
          return undefined;
        },
      });

      if (clack.isCancel(symbolInput)) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

      const symbol = symbolInput.toUpperCase();

      if (!symbol) break;

      // Get asset info
      let asset = snapshotService.getAssetBySymbol(symbol);
      if (!asset) {
        // Asset not found, offer to add it
        console.log(pc.yellow(`\n${symbol} not found in database.`));
        const addNewAsset = await clack.confirm({
          message: 'Would you like to add this asset?',
          initialValue: true,
        });

        if (clack.isCancel(addNewAsset) || !addNewAsset) {
          continue;
        }

        // Ask how to find the asset
        const searchMethod = await clack.select({
          message: 'How would you like to find this asset?',
          options: [
            { value: 'auto', label: 'Search CoinMarketCap automatically' },
            { value: 'manual', label: 'Enter CoinMarketCap ID manually' },
            { value: 'cancel', label: 'Cancel' },
          ],
        });

        if (clack.isCancel(searchMethod) || searchMethod === 'cancel') {
          continue;
        }

        let assetInfo = null;

        if (searchMethod === 'auto') {
          const spinner = clack.spinner();
          spinner.start(`Searching for ${symbol} on CoinMarketCap...`);
          const searchResult = await snapshotService.searchAssetBySymbol(symbol);
          spinner.stop();

          if (!searchResult.found || !searchResult.assetInfo) {
            Logger.error(`Could not find ${symbol} on CoinMarketCap`);
            continue;
          }
          assetInfo = searchResult.assetInfo;
        } else {
          // Manual CMC ID entry
          const cmcIdInput = await clack.text({
            message: 'Enter CoinMarketCap ID:',
            validate: (input: string) => {
              const num = parseInt(input, 10);
              if (isNaN(num) || num <= 0) {
                return 'Please enter a valid positive number';
              }
              return undefined;
            },
          });

          if (clack.isCancel(cmcIdInput)) {
            continue;
          }

          const cmcId = parseInt(cmcIdInput, 10);

          const spinner = clack.spinner();
          spinner.start('Fetching asset info from CoinMarketCap...');
          const searchResult = await snapshotService.searchAssetById(cmcId);
          spinner.stop();

          if (!searchResult.found || !searchResult.assetInfo) {
            Logger.error(`Could not find asset with CMC ID ${cmcId}`);
            continue;
          }
          assetInfo = searchResult.assetInfo;
        }

        // Display asset info for confirmation
        console.log(pc.bold('\nAsset Information:'));
        console.log(`  Name: ${pc.cyan(assetInfo.name)}`);
        console.log(`  Symbol: ${pc.cyan(assetInfo.symbol)}`);
        console.log(`  CMC ID: ${pc.cyan(assetInfo.id)}`);
        if (assetInfo.currentPrice) {
          console.log(`  Current Price: ${pc.green(formatEuro(assetInfo.currentPrice))}`);
        }
        if (assetInfo.marketCap) {
          console.log(
            `  Market Cap: ${pc.green(formatEuro(assetInfo.marketCap / 1_000_000))}M`
          );
        }
        console.log();

        const confirmAdd = await clack.confirm({
          message: 'Add this asset to your database?',
          initialValue: true,
        });

        if (clack.isCancel(confirmAdd) || !confirmAdd) {
          continue;
        }

        // Add asset to database using service
        asset = snapshotService.createAssetFromInfo(assetInfo);
        Logger.success(`Added ${assetInfo.name} (${assetInfo.symbol}) to database`);

        // Update available assets list
        assets.push(asset);
      }

      // Check if asset already exists in this snapshot
      if (existingSymbols.has(symbol)) {
        const existingHolding = existingHoldings.find((h) => h.asset_symbol === symbol);

        const amountInput = await clack.text({
          message: `${symbol} already in snapshot. Amount of ${asset.name} (${symbol}):`,
          placeholder: existingHolding?.amount.toString(),
          defaultValue: existingHolding?.amount.toString(),
          validate: (input: string) => {
            const num = parseFloat(input);
            if (isNaN(num)) {
              return 'Please enter a valid number';
            }
            if (num <= 0) {
              return 'Amount must be positive';
            }
            return undefined;
          },
        });

        if (clack.isCancel(amountInput)) {
          clack.cancel('Operation cancelled');
          DatabaseManager.closeAll();
          process.exit(0);
        }

        const amount = parseFloat(amountInput);

        // Update existing holding using service
        snapshotService.addHolding(snapshot.id, asset.id, amount);
        Logger.success(`Updated ${symbol} to ${amount}`);
        continue;
      }

      const amountInput = await clack.text({
        message: `Amount of ${asset.name} (${symbol}):`,
        validate: (input: string) => {
          const num = parseFloat(input);
          if (isNaN(num)) {
            return 'Please enter a valid number';
          }
          if (num <= 0) {
            return 'Amount must be positive';
          }
          return undefined;
        },
      });

      if (clack.isCancel(amountInput)) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

      const amount = parseFloat(amountInput);

      holdings.push({
        asset,
        amount,
      });

      // Create holding using service
      snapshotService.addHolding(snapshot.id, asset.id, amount);
      Logger.success(`Added ${amount} ${symbol}`);
    }

    if (holdings.length === 0) {
      Logger.warn('No holdings added to snapshot');
      DatabaseManager.closeAll();
      return;
    }

    // If snapshot date is today, fetch and save current prices
    const today = format(new Date(), 'yyyy-MM-dd');
    if (date === today) {
      const spinner = clack.spinner();
      spinner.start('Fetching current prices...');
      try {
        const priceResults = await snapshotService.fetchAndCachePrices(
          holdings.map((h) => h.asset.symbol)
        );

        // Update holding values
        const currentHoldings = snapshotService.getHoldingsBySnapshotId(snapshot.id);
        for (const priceResult of priceResults) {
          if (priceResult.price) {
            const holding = currentHoldings.find((h) => h.asset_symbol === priceResult.symbol);
            if (holding) {
              snapshotService.updateHoldingValue(holding.id, holding.amount * priceResult.price);
            }
          }
        }

        spinner.stop('Current prices saved');
      } catch (error) {
        spinner.stop('Failed to fetch prices');
        Logger.error(error instanceof Error ? error.message : String(error));
      }
    }

    // Summary
    console.log(pc.bold('\nSummary:'));
    console.log(`  Date: ${pc.cyan(date)}`);
    if (snapshot.notes) {
      console.log(`  Notes: ${snapshot.notes}`);
    }
    console.log(pc.bold('  Assets:'));
    holdings.forEach((h) => {
      console.log(`    - ${pc.cyan(h.asset.symbol)}: ${h.amount}`);
    });

    // Display portfolio value (prices already fetched for today's snapshots)
    if (date === today) {
      try {
        const summary = await portfolioService.getPortfolioValue(date);
        if (summary) {
          console.log(
            pc.bold(
              `\nCurrent portfolio value: ${pc.green(formatEuro(summary.totalValue))}\n`
            )
          );
        }
      } catch (error) {
        Logger.error(error instanceof Error ? error.message : String(error));
      }
    } else {
      // For historical snapshots, ask if user wants to fetch current prices for comparison
      const fetchPrices = await clack.confirm({
        message: 'Fetch current prices for comparison?',
        initialValue: false,
      });

      if (clack.isCancel(fetchPrices)) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

      if (fetchPrices) {
        const spinner = clack.spinner();
        spinner.start('Fetching prices from CoinMarketCap...');
        try {
          const priceResults = await snapshotService.fetchAndCachePrices(
            holdings.map((h) => h.asset.symbol)
          );

          // Update holding values (same as today's snapshot logic)
          const currentHoldings = snapshotService.getHoldingsBySnapshotId(snapshot.id);
          for (const priceResult of priceResults) {
            if (priceResult.price) {
              const holding = currentHoldings.find(
                (h) => h.asset_symbol === priceResult.symbol
              );
              if (holding) {
                snapshotService.updateHoldingValue(
                  holding.id,
                  holding.amount * priceResult.price
                );
              }
            }
          }

          // Get portfolio value
          const summary = await portfolioService.getPortfolioValue(date);
          if (summary) {
            spinner.stop('Prices updated');
            console.log(
              pc.bold(
                `\nCurrent portfolio value: ${pc.green(formatEuro(summary.totalValue))}\n`
              )
            );
          }
        } catch (error) {
          spinner.stop('Failed to fetch prices');
          Logger.error(error instanceof Error ? error.message : String(error));
        }
      }
    }

    DatabaseManager.closeAll();
    clack.outro('Snapshot saved successfully!');
  } catch (error) {
    handleSnapshotError(error);
  }
}

async function deleteSnapshot(date: string, assetSymbol?: string) {
  clack.intro('Delete Snapshot');

  try {
    const { snapshotService } = initializeServices();

    if (!validateDate(date)) {
      throw new InvalidDateError(date);
    }

    // Get snapshot with holdings
    const { snapshot, holdings } = snapshotService.getSnapshotByDate(date);

    if (assetSymbol) {
      await deleteSingleHolding(date, assetSymbol, snapshot, holdings, snapshotService);
    } else {
      await deleteEntireSnapshot(date, snapshot, holdings, snapshotService);
    }

    DatabaseManager.closeAll();
    clack.outro('Deletion successful!');
  } catch (error) {
    handleSnapshotError(error);
  }
}

async function deleteSingleHolding(
  date: string,
  assetSymbol: string,
  _snapshot: { id: number; date: string; notes?: string | null },
  holdings: HoldingWithAsset[],
  snapshotService: SnapshotService
) {
  const normalizedSymbol = assetSymbol.toUpperCase().trim();

  const holding = holdings.find(h => h.asset_symbol === normalizedSymbol);

  if (!holding) {
    Logger.error(`Asset ${normalizedSymbol} not found in snapshot ${date}`);
    console.log(pc.cyan('\nAvailable assets in this snapshot:'));
    holdings.forEach(h => console.log(pc.cyan(`  - ${h.asset_symbol}`)));
    DatabaseManager.closeAll();
    clack.outro('Asset not found');
    process.exit(1);
  }

  console.log(pc.yellow('\nYou are about to delete:'));
  console.log(pc.cyan(`  Snapshot: ${date}`));
  console.log(pc.cyan(`  Asset: ${holding.asset_symbol} (${holding.asset_name})`));
  console.log(pc.cyan(`  Amount: ${holding.amount}`));
  if (holding.value_eur) {
    console.log(pc.cyan(`  Value: ${formatEuro(holding.value_eur)}`));
  }
  console.log(pc.yellow(`\nRemaining assets after deletion: ${holdings.length - 1}`));
  console.log();

  const confirm = await clack.confirm({
    message: `Delete ${normalizedSymbol} from snapshot ${date}?`,
    initialValue: false,
  });

  if (clack.isCancel(confirm) || !confirm) {
    clack.cancel('Operation cancelled');
    DatabaseManager.closeAll();
    process.exit(0);
  }

  // Delete using service
  const result = snapshotService.deleteHolding(date, normalizedSymbol);
  Logger.success(`Deleted ${normalizedSymbol} from snapshot ${date}`);

  if (result.remainingHoldings.length > 0) {
    console.log(pc.bold('\nRemaining holdings:'));
    result.remainingHoldings.forEach(h => {
      console.log(pc.cyan(`  - ${h.asset_symbol}: ${h.amount}`));
    });
  } else {
    console.log(pc.yellow('\nNote: This was the last holding. Consider deleting the entire snapshot.'));
  }
}

async function deleteEntireSnapshot(
  date: string,
  snapshot: { id: number; date: string; notes?: string | null },
  holdings: HoldingWithAsset[],
  snapshotService: SnapshotService
) {
  console.log(pc.yellow('\nYou are about to delete:'));
  console.log(pc.cyan(`  Snapshot: ${date}`));
  if (snapshot.notes) {
    console.log(pc.cyan(`  Notes: ${snapshot.notes}`));
  }
  console.log(pc.bold('\n  Holdings:'));
  holdings.forEach(h => {
    console.log(pc.cyan(`    - ${h.asset_symbol} (${h.asset_name}): ${h.amount}`));
    if (h.value_eur) {
      console.log(pc.cyan(`      Value: ${formatEuro(h.value_eur)}`));
    }
  });
  console.log(pc.red(`\nThis will delete the snapshot and all ${holdings.length} holding(s).`));
  console.log();

  const confirm = await clack.confirm({
    message: `Delete entire snapshot for ${date}?`,
    initialValue: false,
  });

  if (clack.isCancel(confirm) || !confirm) {
    clack.cancel('Operation cancelled');
    DatabaseManager.closeAll();
    process.exit(0);
  }

  // Delete using service
  const result = snapshotService.deleteSnapshot(date);
  Logger.success(`Deleted snapshot ${date} and all ${result.deletedHoldingsCount} holding(s)`);
}
