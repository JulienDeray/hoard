import { Command } from 'commander';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { DatabaseManager } from '../../database/connection.js';
import { LedgerRepository } from '../../database/ledger.js';
import { RatesRepository } from '../../database/rates.js';
import { CoinMarketCapService } from '../../services/coinmarketcap.js';
import { PortfolioService } from '../../services/portfolio.js';
import { AllocationService } from '../../services/allocation.js';
import { configManager } from '../../utils/config.js';
import { Logger } from '../../utils/logger.js';
import { formatEuro } from '../../utils/formatters.js';
import type { CreateAllocationTargetInput } from '../../models/index.js';

export const allocationCommand = new Command('allocation')
  .description('Manage portfolio allocation targets')
  .addCommand(
    new Command('set').description('Set allocation targets interactively').action(setAllocationTargets)
  )
  .addCommand(
    new Command('view').description('View current allocation targets').action(viewAllocationTargets)
  )
  .addCommand(
    new Command('compare')
      .description('Compare current allocation vs targets')
      .option('-d, --date <date>', 'Snapshot date (YYYY-MM-DD)')
      .action(compareAllocations)
  )
  .addCommand(
    new Command('clear').description('Clear all allocation targets').action(clearAllocationTargets)
  );

async function setAllocationTargets() {
  clack.intro('Set Allocation Targets');

  try {
    const config = configManager.get();
    const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
    const ledgerRepo = new LedgerRepository(ledgerDb);

    // Get existing targets
    const existingTargets = ledgerRepo.listAllocationTargets();

    if (existingTargets.length > 0) {
      console.log(pc.yellow('\nExisting targets:'));
      for (const target of existingTargets) {
        console.log(pc.gray(`  ${target.asset_symbol}: ${target.target_percentage}%`));
      }
      console.log();

      const replace = await clack.confirm({
        message: 'Replace existing targets?',
        initialValue: false,
      });

      if (clack.isCancel(replace) || !replace) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }
    }

    // Get available assets
    const assets = ledgerRepo.listAssets();
    console.log(pc.bold('\nAvailable assets:'));
    console.log(pc.gray('  ' + assets.map((a) => a.symbol).join(', ')));
    console.log(pc.gray('  OTHER (wildcard for unlisted assets)'));
    console.log();

    const targets: CreateAllocationTargetInput[] = [];
    let remainingPercentage = 100;

    console.log(pc.bold('Enter allocation targets (must sum to 100%):\n'));

    while (remainingPercentage > 0) {
      const symbolInput = await clack.text({
        message: `Asset symbol (${remainingPercentage.toFixed(1)}% remaining, press enter to finish):`,
        placeholder: 'BTC, ETH, OTHER...',
        defaultValue: '',
      });

      if (clack.isCancel(symbolInput)) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

      const symbol = symbolInput.toUpperCase().trim();
      if (!symbol) break;

      // Validate not duplicate
      if (targets.find((t) => t.asset_symbol === symbol)) {
        Logger.error(`${symbol} already added`);
        continue;
      }

      const percentageInput = await clack.text({
        message: `Target percentage for ${symbol}:`,
        placeholder: `Max ${remainingPercentage.toFixed(1)}%`,
        validate: (input: string) => {
          const num = parseFloat(input);
          if (isNaN(num)) return 'Please enter a valid number';
          if (num <= 0) return 'Percentage must be positive';
          if (num > remainingPercentage + 0.01) {
            return `Cannot exceed remaining ${remainingPercentage.toFixed(1)}%`;
          }
        },
      });

      if (clack.isCancel(percentageInput)) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

      const percentage = parseFloat(percentageInput);
      targets.push({ asset_symbol: symbol, target_percentage: percentage });
      remainingPercentage -= percentage;

      Logger.success(
        `Added ${symbol}: ${percentage}% (${remainingPercentage.toFixed(1)}% remaining)`
      );
    }

    // Validate sum
    const sum = targets.reduce((acc, t) => acc + t.target_percentage, 0);
    if (Math.abs(sum - 100) > 0.01) {
      Logger.error(`Targets sum to ${sum.toFixed(2)}%, must equal 100%`);

      const continueAnyway = await clack.confirm({
        message: 'Continue anyway? (targets will be invalid)',
        initialValue: false,
      });

      if (clack.isCancel(continueAnyway) || !continueAnyway) {
        DatabaseManager.closeAll();
        clack.outro('Operation cancelled');
        return;
      }
    }

    // Save targets
    ledgerRepo.setAllocationTargets(targets);

    console.log(pc.bold('\nAllocation targets saved:'));
    for (const target of targets) {
      console.log(`  ${pc.cyan(target.asset_symbol)}: ${target.target_percentage}%`);
    }

    DatabaseManager.closeAll();
    clack.outro('Allocation targets set successfully!');
  } catch (error) {
    Logger.error(
      `Failed to set targets: ${error instanceof Error ? error.message : String(error)}`
    );
    DatabaseManager.closeAll();
    clack.outro('Failed to set allocation targets');
    process.exit(1);
  }
}

async function viewAllocationTargets() {
  clack.intro('Allocation Targets');

  try {
    const config = configManager.get();
    const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
    const ledgerRepo = new LedgerRepository(ledgerDb);

    const targets = ledgerRepo.listAllocationTargets();

    if (targets.length === 0) {
      Logger.info('No allocation targets set');
      DatabaseManager.closeAll();
      clack.outro('Run "allocation set" to create targets');
      return;
    }

    const validation = ledgerRepo.validateAllocationTargets();

    console.log(pc.bold('\nAllocation Targets:\n'));

    for (const target of targets) {
      console.log(`  ${pc.bold(target.asset_symbol)}: ${pc.cyan(target.target_percentage + '%')}`);
      if (target.notes) {
        console.log(pc.gray(`    Note: ${target.notes}`));
      }
    }

    console.log();
    console.log(pc.bold(`Total: ${pc.cyan(validation.sum.toFixed(2) + '%')}`));

    if (!validation.valid) {
      console.log(pc.red('\n⚠ Warning: ' + validation.errors.join(', ')));
    }

    DatabaseManager.closeAll();
    clack.outro(`${targets.length} target(s) defined`);
  } catch (error) {
    Logger.error(
      `Failed to view targets: ${error instanceof Error ? error.message : String(error)}`
    );
    DatabaseManager.closeAll();
    process.exit(1);
  }
}

async function compareAllocations(options: { date?: string }) {
  clack.intro('Allocation Comparison');

  const spinner = clack.spinner();
  spinner.start('Loading portfolio and targets...');

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
    const allocationService = new AllocationService(ledgerRepo, portfolioService);

    const summary = await allocationService.getAllocationSummary(options.date);

    if (!summary) {
      spinner.stop('No portfolio data found');
      DatabaseManager.closeAll();
      clack.outro('No data available');
      return;
    }

    if (!summary.has_targets) {
      spinner.stop('No allocation targets set');
      Logger.info('Set targets with: allocation set');
      DatabaseManager.closeAll();
      clack.outro('No targets to compare');
      return;
    }

    spinner.stop('Data loaded');

    console.log(pc.bold(`\nAllocation Comparison (${summary.date})`));
    console.log(pc.bold(`Total Value: ${pc.green(formatEuro(summary.total_value))}\n`));

    if (!summary.targets_sum_valid) {
      console.log(pc.red('⚠ Warning: Targets do not sum to 100%\n'));
    }

    // Table header
    const colWidth = 12;
    console.log(
      pc.bold('Asset'.padEnd(colWidth)) +
        pc.bold('Current'.padEnd(colWidth)) +
        pc.bold('Target'.padEnd(colWidth)) +
        pc.bold('Diff'.padEnd(colWidth)) +
        pc.bold('Amount')
    );
    console.log('─'.repeat(colWidth * 5));

    // Data rows
    for (const alloc of summary.allocations) {
      const currentPct = alloc.current_percentage.toFixed(1) + '%';
      const targetPct = alloc.target_percentage.toFixed(1) + '%';
      const diffPct =
        (alloc.difference_percentage >= 0 ? '+' : '') + alloc.difference_percentage.toFixed(1) + '%';
      const diffValue =
        (alloc.difference_value >= 0 ? '+' : '') + formatEuro(alloc.difference_value);

      const diffColor =
        Math.abs(alloc.difference_percentage) > 2
          ? alloc.difference_percentage > 0
            ? pc.red
            : pc.yellow
          : pc.green;

      console.log(
        alloc.asset_symbol.padEnd(colWidth) +
          currentPct.padEnd(colWidth) +
          targetPct.padEnd(colWidth) +
          diffColor(diffPct.padEnd(colWidth)) +
          diffColor(diffValue)
      );
    }

    console.log();

    DatabaseManager.closeAll();
    clack.outro('Allocation comparison complete');
  } catch (error) {
    spinner.stop('Failed to compare allocations');
    Logger.error(error instanceof Error ? error.message : String(error));
    DatabaseManager.closeAll();
    process.exit(1);
  }
}

async function clearAllocationTargets() {
  clack.intro('Clear Allocation Targets');

  try {
    const config = configManager.get();
    const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
    const ledgerRepo = new LedgerRepository(ledgerDb);

    const targets = ledgerRepo.listAllocationTargets();

    if (targets.length === 0) {
      Logger.info('No allocation targets to clear');
      DatabaseManager.closeAll();
      clack.outro('No targets found');
      return;
    }

    console.log(pc.yellow('\nCurrent targets:'));
    for (const target of targets) {
      console.log(pc.gray(`  ${target.asset_symbol}: ${target.target_percentage}%`));
    }
    console.log();

    const confirm = await clack.confirm({
      message: 'Are you sure you want to clear all targets?',
      initialValue: false,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel('Operation cancelled');
      DatabaseManager.closeAll();
      process.exit(0);
    }

    ledgerRepo.setAllocationTargets([]);

    Logger.success('All allocation targets cleared');
    DatabaseManager.closeAll();
    clack.outro('Targets cleared successfully');
  } catch (error) {
    Logger.error(
      `Failed to clear targets: ${error instanceof Error ? error.message : String(error)}`
    );
    DatabaseManager.closeAll();
    process.exit(1);
  }
}
