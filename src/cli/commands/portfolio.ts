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
import { getCurrentEnvironment } from '../index.js';

export const portfolioCommand = new Command('portfolio')
  .description('Portfolio analysis and reporting')
  .addCommand(
    new Command('summary')
      .description('Show current portfolio summary with values')
      .action(showSummary)
  );

async function showSummary() {
  clack.intro('Portfolio Summary');

  const spinner = clack.spinner();
  spinner.start('Loading portfolio...');

  try {
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

    const summary = await portfolioService.getPortfolioValue();

    if (!summary) {
      spinner.stop('No portfolio data found');
      Logger.info('Add your first snapshot with: crypto-tracker snapshot add');
      DatabaseManager.closeAll();
      clack.outro('No portfolio data available');
      return;
    }

    spinner.stop('Portfolio loaded');

    console.log(pc.bold(`\nPortfolio Summary (as of ${summary.date})\n`));

    // Holdings table
    console.log(pc.bold('Holdings:'));
    for (const holding of summary.holdings) {
      const priceStr = holding.current_price_eur
        ? formatEuro(holding.current_price_eur)
        : 'N/A';
      const valueStr = holding.current_value_eur
        ? formatEuro(holding.current_value_eur)
        : 'N/A';

      const percentage = holding.current_value_eur
        ? ((holding.current_value_eur / summary.totalValue) * 100).toFixed(1)
        : '0.0';

      console.log(`  ${pc.bold(holding.asset_symbol)} (${holding.asset_name})`);
      console.log(
        `    ${holding.amount} ${holding.asset_symbol}` +
          pc.bold(' = ') +
          pc.green(valueStr) +
          pc.cyan(` (@ ${priceStr})`) +
          ` - ${percentage}%`
      );
      console.log();
    }

    // Show allocation comparison if targets exist
    const allocationService = new AllocationService(ledgerRepo, portfolioService);
    const allocationSummary = await allocationService.getAllocationSummary();

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
          `  ${arrow} ${pc.bold(alloc.target_key)}: ` +
            `${alloc.current_percentage.toFixed(1)}% (target: ${alloc.target_percentage.toFixed(1)}%)`
        );
      }
      console.log();
    }

    // Total
    console.log(
      pc.bold(`Total Portfolio Value: ${pc.green(formatEuro(summary.totalValue))}\n`)
    );

    DatabaseManager.closeAll();
    clack.outro(`Portfolio loaded: ${summary.holdings.length} asset(s)`);
  } catch (error) {
    spinner.stop('Failed to load portfolio');
    Logger.error(error instanceof Error ? error.message : String(error));
    DatabaseManager.closeAll();
    clack.outro('Failed to load portfolio');
    process.exit(1);
  }
}
