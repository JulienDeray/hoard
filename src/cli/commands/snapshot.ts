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
import { configManager } from '../../utils/config.js';
import { Logger } from '../../utils/logger.js';
import { validateDate } from '../../utils/validators.js';
import { formatEuro } from '../../utils/formatters.js';

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
  );

async function addSnapshot() {
  clack.intro('Add Portfolio Snapshot');

  try {
    const config = configManager.get();
    const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
    const ledgerRepo = new LedgerRepository(ledgerDb);

    // Prompt for snapshot date
    const date = await clack.text({
      message: 'Enter snapshot date (YYYY-MM-DD):',
      placeholder: format(new Date(), 'yyyy-MM-dd'),
      defaultValue: format(new Date(), 'yyyy-MM-dd'),
      validate: (input: string) => {
        if (!validateDate(input)) {
          return 'Please enter a valid date in YYYY-MM-DD format';
        }
      },
    });

    if (clack.isCancel(date)) {
      clack.cancel('Operation cancelled');
      DatabaseManager.closeAll();
      process.exit(0);
    }

    // Check if snapshot already exists
    let snapshot = ledgerRepo.getSnapshotByDate(date);

    if (snapshot) {
      // Snapshot exists, ask if user wants to add to it
      const existingHoldings = ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
      console.log(pc.yellow(`\nSnapshot already exists for ${date}`));
      console.log(pc.gray(`Current holdings: ${existingHoldings.length} asset(s)`));

      const addToExisting = await clack.confirm({
        message: 'Add more holdings to this snapshot?',
        initialValue: true,
      });

      if (clack.isCancel(addToExisting) || !addToExisting) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

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

      snapshot = ledgerRepo.createSnapshot({ date, notes: notes || undefined });
      Logger.success(`Snapshot created for ${date}`);
    }

    console.log(pc.bold('\nAdding holdings to snapshot...\n'));

    // Get available assets and existing holdings
    const assets = ledgerRepo.listAssets();
    const assetSymbols = assets.map((a) => a.symbol);
    const existingHoldings = ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
    const existingSymbols = new Set(existingHoldings.map((h) => h.asset_symbol));

    // Show existing holdings if any
    if (existingHoldings.length > 0) {
      console.log(pc.gray('Existing holdings:'));
      existingHoldings.forEach((h) => {
        console.log(pc.gray(`  - ${h.asset_symbol}: ${h.amount}`));
      });
      console.log();
    }

    const holdings: Array<{ symbol: string; name: string; amount: number }> = [];

    while (true) {
      const symbolInput = await clack.text({
        message: 'Asset symbol (press enter to finish):',
        placeholder: 'BTC, ETH, SOL...',
        defaultValue: '',
        validate: (input: string) => {
          if (!input) return; // Allow empty to finish
          if (input.length > 10) {
            return 'Symbol too long (max 10 characters)';
          }
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
      let asset = ledgerRepo.getAsset(symbol);
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

        const ratesDb = DatabaseManager.getRatesDb(config.database.ratesPath);
        const ratesRepo = new RatesRepository(ratesDb, config.cache.rateCacheTTL);
        const cmcService = new CoinMarketCapService(config.api.coinmarketcap.apiKey);

        let assetInfo = null;

        if (searchMethod === 'auto') {
          const spinner = clack.spinner();
          spinner.start(`Searching for ${symbol} on CoinMarketCap...`);
          assetInfo = await cmcService.getAssetInfoBySymbol(symbol, config.defaults.baseCurrency);
          spinner.stop();

          if (!assetInfo) {
            Logger.error(`Could not find ${symbol} on CoinMarketCap`);
            continue;
          }
        } else {
          // Manual CMC ID entry
          const cmcIdInput = await clack.text({
            message: 'Enter CoinMarketCap ID:',
            validate: (input: string) => {
              const num = parseInt(input, 10);
              if (isNaN(num) || num <= 0) {
                return 'Please enter a valid positive number';
              }
            },
          });

          if (clack.isCancel(cmcIdInput)) {
            continue;
          }

          const cmcId = parseInt(cmcIdInput, 10);

          const spinner = clack.spinner();
          spinner.start('Fetching asset info from CoinMarketCap...');
          assetInfo = await cmcService.getAssetInfoById(cmcId, config.defaults.baseCurrency);
          spinner.stop();

          if (!assetInfo) {
            Logger.error(`Could not find asset with CMC ID ${cmcId}`);
            continue;
          }
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

        // Add asset to database
        asset = ledgerRepo.createAsset({
          symbol: assetInfo.symbol,
          name: assetInfo.name,
          cmc_id: assetInfo.id,
        });

        Logger.success(`Added ${assetInfo.name} (${assetInfo.symbol}) to database`);

        // Update available assets list
        assets.push(asset);
        assetSymbols.push(asset.symbol);
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
          },
        });

        if (clack.isCancel(amountInput)) {
          clack.cancel('Operation cancelled');
          DatabaseManager.closeAll();
          process.exit(0);
        }

        const amount = parseFloat(amountInput);

        // Update existing holding
        if (existingHolding) {
          ledgerRepo.updateHolding(existingHolding.id, { amount });
          Logger.success(`Updated ${symbol} to ${amount}`);
        }
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
        },
      });

      if (clack.isCancel(amountInput)) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

      const amount = parseFloat(amountInput);

      holdings.push({
        symbol: asset.symbol,
        name: asset.name,
        amount,
      });

      // Create holding
      ledgerRepo.createHolding({
        snapshot_id: snapshot.id,
        asset_symbol: asset.symbol,
        asset_name: asset.name,
        amount,
      });

      Logger.success(`Added ${amount} ${symbol}`);
    }

    if (holdings.length === 0) {
      Logger.warn('No holdings added to snapshot');
      DatabaseManager.closeAll();
      return;
    }

    // If snapshot date is today, fetch and save current prices as acquisition prices
    const today = format(new Date(), 'yyyy-MM-dd');
    if (date === today) {
      const spinner = clack.spinner();
      spinner.start('Fetching current prices for acquisition tracking...');
      try {
        const ratesDb = DatabaseManager.getRatesDb(config.database.ratesPath);
        const ratesRepo = new RatesRepository(ratesDb, config.cache.rateCacheTTL);
        const cmcService = new CoinMarketCapService(config.api.coinmarketcap.apiKey);

        for (const holding of holdings) {
          try {
            const price = await cmcService.getCurrentPrice(
              holding.symbol,
              config.defaults.baseCurrency
            );

            if (price) {
              // Update cache
              ratesRepo.updateCachedRate(
                holding.symbol,
                price,
                config.defaults.baseCurrency
              );

              // Update holding with acquisition price and date
              const dbHolding = ledgerRepo
                .getHoldingsBySnapshotId(snapshot.id)
                .find((h) => h.asset_symbol === holding.symbol);

              if (dbHolding) {
                ledgerRepo.updateHolding(dbHolding.id, {
                  acquisition_price_eur: price,
                  acquisition_date: date,
                });
              }
            }
          } catch (error) {
            spinner.stop(
              `Could not fetch price for ${holding.symbol}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        spinner.stop('Current prices saved as acquisition prices');
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
      console.log(`    - ${pc.cyan(h.symbol)}: ${h.amount}`);
    });

    // Display portfolio value (prices already fetched for today's snapshots)
    if (date === today) {
      try {
        const ratesDb = DatabaseManager.getRatesDb(config.database.ratesPath);
        const ratesRepo = new RatesRepository(ratesDb, config.cache.rateCacheTTL);
        const cmcService = new CoinMarketCapService(config.api.coinmarketcap.apiKey);
        const portfolioService = new PortfolioService(
          ledgerRepo,
          ratesRepo,
          cmcService,
          config.defaults.baseCurrency
        );

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
          const ratesDb = DatabaseManager.getRatesDb(config.database.ratesPath);
          const ratesRepo = new RatesRepository(ratesDb, config.cache.rateCacheTTL);
          const cmcService = new CoinMarketCapService(config.api.coinmarketcap.apiKey);
          const portfolioService = new PortfolioService(
            ledgerRepo,
            ratesRepo,
            cmcService,
            config.defaults.baseCurrency
          );

          await portfolioService.fetchAndCachePrices(holdings.map((h) => h.symbol));

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
    Logger.error(`Failed to add snapshot: ${error instanceof Error ? error.message : String(error)}`);
    DatabaseManager.closeAll();
    clack.outro('Failed to add snapshot');
    process.exit(1);
  }
}

async function listSnapshots(options: { assets?: string; last?: number }) {
  clack.intro('Portfolio Snapshots');

  try {
    const config = configManager.get();
    const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
    const ledgerRepo = new LedgerRepository(ledgerDb);

    const allSnapshots = ledgerRepo.listSnapshots();
    const totalSnapshots = allSnapshots.length;

    if (allSnapshots.length === 0) {
      Logger.info('No snapshots found');
      DatabaseManager.closeAll();
      clack.outro('No snapshots to display');
      return;
    }

    // Apply --last filter to show only recent N snapshots
    // Note: snapshots are returned in DESC order (newest first) from the database
    let snapshots = allSnapshots;
    if (options.last && options.last > 0) {
      snapshots = snapshots.slice(0, options.last);
    }

    // Get all unique asset symbols across filtered snapshots
    const allAssets = new Set<string>();
    const snapshotData = snapshots.map((snapshot) => {
      const holdings = ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
      const holdingsMap = new Map(
        holdings.map((h) => {
          allAssets.add(h.asset_symbol);
          return [h.asset_symbol, h.amount];
        })
      );
      return { snapshot, holdingsMap };
    });

    // Apply --assets filter to show only specific assets
    let assetSymbols = Array.from(allAssets).sort();
    if (options.assets) {
      const requestedAssets = options.assets.split(',').map((s) => s.trim().toUpperCase());
      assetSymbols = assetSymbols.filter((symbol) => requestedAssets.includes(symbol));

      if (assetSymbols.length === 0) {
        Logger.error('None of the requested assets were found in the snapshots');
        DatabaseManager.closeAll();
        clack.outro('No matching assets found');
        return;
      }
    }

    // Build horizontal table (dates as rows, assets as columns)
    console.log(pc.bold(`\nPortfolio Snapshots:\n`));

    // Show filter info if filters are applied
    if (options.assets || options.last) {
      const filters: string[] = [];
      if (options.assets) filters.push(`assets: ${assetSymbols.join(', ')}`);
      if (options.last) filters.push(`last ${options.last} snapshot(s)`);
      console.log(pc.cyan(`Filters: ${filters.join(', ')}\n`));
    }

    // Header row
    const dateColWidth = 12;
    const assetColWidth = 15;
    let header = 'Date'.padEnd(dateColWidth);
    assetSymbols.forEach((symbol) => {
      header += symbol.padEnd(assetColWidth);
    });
    console.log(pc.bold(header));
    console.log('─'.repeat(dateColWidth + assetSymbols.length * assetColWidth));

    // Data rows
    for (const { snapshot, holdingsMap } of snapshotData) {
      let row = snapshot.date.padEnd(dateColWidth);
      assetSymbols.forEach((symbol) => {
        const amount = holdingsMap.get(symbol);
        const value = amount !== undefined ? amount.toString() : '─';
        row += value.padEnd(assetColWidth);
      });
      console.log(row);
    }

    console.log();

    DatabaseManager.closeAll();
    const filterInfo = snapshots.length < totalSnapshots
      ? ` (${snapshots.length} of ${totalSnapshots} total)`
      : '';
    clack.outro(`Found ${snapshots.length} snapshot(s)${filterInfo}`);
  } catch (error) {
    Logger.error(`Failed to list snapshots: ${error instanceof Error ? error.message : String(error)}`);
    DatabaseManager.closeAll();
    clack.outro('Failed to list snapshots');
    process.exit(1);
  }
}

async function viewSnapshot(date: string) {
  clack.intro(`View Snapshot: ${date}`);

  try {
    const config = configManager.get();
    const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
    const ratesDb = DatabaseManager.getRatesDb(config.database.ratesPath);
    const ledgerRepo = new LedgerRepository(ledgerDb);
    const ratesRepo = new RatesRepository(ratesDb, config.cache.rateCacheTTL);
    const cmcService = new CoinMarketCapService(config.api.coinmarketcap.apiKey);
    const portfolioService = new PortfolioService(
      ledgerRepo,
      ratesRepo,
      cmcService,
      config.defaults.baseCurrency
    );

    const snapshot = ledgerRepo.getSnapshotByDate(date);

    if (!snapshot) {
      Logger.error(`No snapshot found for ${date}`);
      DatabaseManager.closeAll();
      clack.outro('Snapshot not found');
      return;
    }

    console.log(pc.bold(`\nSnapshot: ${snapshot.date}\n`));
    if (snapshot.notes) {
      console.log(pc.gray(`Notes: ${snapshot.notes}\n`));
    }

    const summary = await portfolioService.getPortfolioValue(date);

    if (!summary || summary.holdings.length === 0) {
      Logger.info('No holdings in this snapshot');
      DatabaseManager.closeAll();
      clack.outro('No holdings to display');
      return;
    }

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
          pc.gray(` (@ ${priceStr})`)
      );
      console.log();
    }

    // Show allocation comparison if targets exist
    const allocationService = new AllocationService(ledgerRepo, portfolioService);
    const allocationSummary = await allocationService.getAllocationSummary(date);

    if (allocationSummary && allocationSummary.has_targets) {
      console.log(pc.bold('Allocation vs Targets:'));

      if (!allocationSummary.targets_sum_valid) {
        console.log(pc.yellow('  ⚠ Warning: Targets do not sum to 100%'));
      }

      for (const alloc of allocationSummary.allocations) {
        const arrow =
          Math.abs(alloc.difference_percentage) <= 2
            ? pc.green('✓')
            : alloc.difference_percentage > 0
              ? pc.red('▲')
              : pc.yellow('▼');

        console.log(
          `  ${arrow} ${pc.bold(alloc.asset_symbol)}: ` +
            `${alloc.current_percentage.toFixed(1)}% (target: ${alloc.target_percentage.toFixed(1)}%)`
        );
      }
      console.log();
    }

    if (summary.totalValue) {
      console.log(
        pc.bold(`Total Value: ${pc.green(formatEuro(summary.totalValue))}\n`)
      );
    }

    DatabaseManager.closeAll();
    clack.outro(`Snapshot loaded: ${summary.holdings.length} holding(s)`);
  } catch (error) {
    Logger.error(`Failed to view snapshot: ${error instanceof Error ? error.message : String(error)}`);
    DatabaseManager.closeAll();
    clack.outro('Failed to view snapshot');
    process.exit(1);
  }
}
