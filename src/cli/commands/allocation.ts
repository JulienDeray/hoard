import { Command } from 'commander';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { DatabaseManager } from '../../database/connection.js';
import { LedgerRepository } from '../../database/ledger.js';
import { RatesRepository } from '../../database/rates.js';
import { CoinMarketCapService } from '../../services/coinmarketcap.js';
import { PortfolioService } from '../../services/portfolio.js';
import { AllocationService } from '../../services/allocation.js';
import { AllocationTargetService } from '../../services/allocation-target.js';
import { configManager } from '../../utils/config.js';
import { Logger } from '../../utils/logger.js';
import { formatEuro } from '../../utils/formatters.js';
import { getCurrentEnvironment } from '../index.js';
import {
  ServiceError,
  NoAllocationTargetsError,
  DuplicateAllocationTargetError,
  AllocationTargetsSumError,
} from '../../errors/index.js';
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

// ============================================================================
// Helper: Initialize services
// ============================================================================

function initializeServices() {
  const env = getCurrentEnvironment();
  const config = configManager.getWithEnvironment(env);
  const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
  const ledgerRepo = new LedgerRepository(ledgerDb);
  const allocationTargetService = new AllocationTargetService(ledgerRepo);

  return { config, ledgerRepo, allocationTargetService };
}

function initializeFullServices() {
  const env = getCurrentEnvironment();
  const config = configManager.getWithEnvironment(env);
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
  const allocationTargetService = new AllocationTargetService(ledgerRepo);

  return { config, ledgerRepo, allocationService, allocationTargetService };
}

// ============================================================================
// Helper: Handle service errors
// ============================================================================

function handleAllocationError(error: unknown): never {
  if (error instanceof NoAllocationTargetsError) {
    Logger.info('No allocation targets to clear');
    DatabaseManager.closeAll();
    clack.outro('No targets found');
    process.exit(0);
  }

  if (error instanceof DuplicateAllocationTargetError) {
    Logger.error(`${error.targetKey} already added`);
    DatabaseManager.closeAll();
    clack.outro('Duplicate target');
    process.exit(1);
  }

  if (error instanceof AllocationTargetsSumError) {
    Logger.error(`Targets sum to ${error.sum.toFixed(2)}%, must equal 100%`);
    DatabaseManager.closeAll();
    clack.outro('Invalid allocation sum');
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

async function setAllocationTargets() {
  clack.intro('Set Allocation Targets');

  try {
    const { ledgerRepo, allocationTargetService } = initializeServices();

    // Check for existing targets
    const existingTargets = allocationTargetService.getExistingTargetsForDisplay();

    if (existingTargets) {
      // Display existing targets
      console.log(pc.yellow('\nExisting targets:'));
      for (const target of existingTargets) {
        console.log(pc.cyan(`  ${target.target_key}: ${target.target_percentage}%`));
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

    // Show available assets
    const assets = ledgerRepo.listAssets();
    console.log(pc.bold('\nAvailable assets:'));
    console.log(pc.cyan('  ' + assets.map((a) => a.symbol).join(', ')));
    console.log(pc.cyan('  OTHER (wildcard for unlisted assets)'));
    console.log();

    // Collect targets interactively
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

      // Check for duplicate
      if (targets.find((t) => t.target_key === symbol)) {
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
          return undefined;
        },
      });

      if (clack.isCancel(percentageInput)) {
        clack.cancel('Operation cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }

      const percentage = parseFloat(percentageInput);
      targets.push({ target_key: symbol, target_percentage: percentage });
      remainingPercentage = allocationTargetService.calculateRemainingPercentage(targets);

      Logger.success(
        `Added ${symbol}: ${percentage}% (${remainingPercentage.toFixed(1)}% remaining)`
      );
    }

    if (targets.length === 0) {
      Logger.warn('No targets entered');
      DatabaseManager.closeAll();
      clack.outro('Operation cancelled');
      return;
    }

    // Validate sum before saving
    const sum = targets.reduce((acc, t) => acc + t.target_percentage, 0);
    let allowInvalidSum = false;

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

      allowInvalidSum = true;
    }

    // Save targets using service
    const result = allocationTargetService.setTargets({ targets, allowInvalidSum });

    // Display saved targets
    console.log(pc.bold('\nAllocation targets saved:'));
    for (const target of result.targets) {
      console.log(`  ${pc.cyan(target.target_key)}: ${target.target_percentage}%`);
    }

    DatabaseManager.closeAll();
    clack.outro('Allocation targets set successfully!');
  } catch (error) {
    handleAllocationError(error);
  }
}

async function viewAllocationTargets() {
  clack.intro('Allocation Targets');

  try {
    const { allocationTargetService } = initializeServices();

    const targets = allocationTargetService.listTargets();

    if (targets.length === 0) {
      Logger.info('No allocation targets set');
      DatabaseManager.closeAll();
      clack.outro('Run "allocation set" to create targets');
      return;
    }

    const validation = allocationTargetService.validateTargets();

    // Display targets
    console.log(pc.bold('\nAllocation Targets:\n'));

    for (const target of targets) {
      console.log(`  ${pc.bold(target.target_key)}: ${pc.cyan(target.target_percentage + '%')}`);
      if (target.notes) {
        console.log(pc.cyan(`    Note: ${target.notes}`));
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
    handleAllocationError(error);
  }
}

async function compareAllocations(options: { date?: string }) {
  clack.intro('Allocation Comparison');

  const spinner = clack.spinner();
  spinner.start('Loading portfolio and targets...');

  try {
    const { allocationService, allocationTargetService } = initializeFullServices();

    // Check if targets exist first
    if (!allocationTargetService.hasTargets()) {
      spinner.stop('No allocation targets set');
      Logger.info('Set targets with: allocation set');
      DatabaseManager.closeAll();
      clack.outro('No targets to compare');
      return;
    }

    const summary = await allocationService.getAllocationSummary(options.date);

    if (!summary) {
      spinner.stop('No portfolio data found');
      DatabaseManager.closeAll();
      clack.outro('No data available');
      return;
    }

    spinner.stop('Data loaded');

    // Display comparison
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
        alloc.target_key.padEnd(colWidth) +
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
    handleAllocationError(error);
  }
}

async function clearAllocationTargets() {
  clack.intro('Clear Allocation Targets');

  try {
    const { allocationTargetService } = initializeServices();

    // Get existing targets for display
    const existingTargets = allocationTargetService.getExistingTargetsForDisplay();

    if (!existingTargets) {
      Logger.info('No allocation targets to clear');
      DatabaseManager.closeAll();
      clack.outro('No targets found');
      return;
    }

    // Display current targets
    console.log(pc.yellow('\nCurrent targets:'));
    for (const target of existingTargets) {
      console.log(pc.cyan(`  ${target.target_key}: ${target.target_percentage}%`));
    }
    console.log();

    // Confirm deletion
    const confirm = await clack.confirm({
      message: 'Are you sure you want to clear all targets?',
      initialValue: false,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel('Operation cancelled');
      DatabaseManager.closeAll();
      process.exit(0);
    }

    // Clear targets using service
    const clearedCount = allocationTargetService.clearTargets();

    Logger.success(`All ${clearedCount} allocation target(s) cleared`);
    DatabaseManager.closeAll();
    clack.outro('Targets cleared successfully');
  } catch (error) {
    handleAllocationError(error);
  }
}
