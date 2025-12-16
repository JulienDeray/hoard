import { Command } from 'commander';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { DatabaseManager } from '../../database/connection.js';
import { LedgerRepository } from '../../database/ledger.js';
import { RatesRepository } from '../../database/rates.js';
import { CoinMarketCapService } from '../../services/coinmarketcap.js';
import { PortfolioService } from '../../services/portfolio.js';
import { ClaudeService } from '../../services/claude.js';
import { QueryProcessor } from '../../services/query-processor.js';
import { configManager } from '../../utils/config.js';
import { Logger } from '../../utils/logger.js';

export const queryCommand = new Command('query')
  .description('Ask natural language questions about your crypto portfolio')
  .argument('<question>', 'Your question in natural language')
  .action(processQuery);

async function processQuery(question: string) {
  clack.intro('Portfolio Query');

  const spinner = clack.spinner();
  spinner.start('Processing your query...');

  try {
    const config = configManager.get();

    // Initialize services
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

    const claudeService = new ClaudeService(
      config.api.anthropic.apiKey,
      config.api.anthropic.model
    );

    const queryProcessor = new QueryProcessor(
      claudeService,
      portfolioService,
      ledgerRepo,
      ratesRepo
    );

    // Process the query
    const response = await queryProcessor.processQuery(question);

    spinner.stop('Query complete');
    console.log('\n' + pc.bold('Answer:'));
    console.log(response + '\n');

    DatabaseManager.closeAll();
    clack.outro('Query completed successfully');
  } catch (error) {
    spinner.stop('Query failed');
    Logger.error(error instanceof Error ? error.message : String(error));
    DatabaseManager.closeAll();
    clack.outro('Query failed');
    process.exit(1);
  }
}
