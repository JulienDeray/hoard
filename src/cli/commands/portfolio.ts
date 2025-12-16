import { Command } from 'commander';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { DatabaseManager } from '../../database/connection.js';
import { LedgerRepository } from '../../database/ledger.js';
import { RatesRepository } from '../../database/rates.js';
import { CoinMarketCapService } from '../../services/coinmarketcap.js';
import { PortfolioService } from '../../services/portfolio.js';
import { configManager } from '../../utils/config.js';
import { Logger } from '../../utils/logger.js';
import { formatEuro } from '../../utils/formatters.js';

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
        ? pc.green(formatEuro(holding.current_value_eur))
        : pc.gray('N/A');

      const percentage = holding.current_value_eur
        ? ((holding.current_value_eur / summary.totalValue) * 100).toFixed(1)
        : '0.0';

      console.log(`  ${pc.bold(holding.asset_symbol)} (${holding.asset_name})`);
      console.log(pc.gray(`    Amount: ${holding.amount}`));
      console.log(pc.gray(`    Price: ${priceStr}`));
      console.log(`    Value: ${valueStr} (${percentage}%)`);
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
