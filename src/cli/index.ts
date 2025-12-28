#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { snapshotCommand } from './commands/snapshot.js';
import { queryCommand } from './commands/query.js';
import { portfolioCommand } from './commands/portfolio.js';
import { allocationCommand } from './commands/allocation.js';
import { envCommand } from './commands/env.js';
import { configManager } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

// Load environment variables
config();

const program = new Command();

program
  .name('crypto-tracker')
  .description('CLI tool for tracking crypto assets with natural language queries')
  .version('0.1.0')
  .option('--env <environment>', 'Environment to use (dev or prod)', 'dev');

// Add commands
program.addCommand(snapshotCommand);
program.addCommand(queryCommand);
program.addCommand(portfolioCommand);
program.addCommand(allocationCommand);
program.addCommand(envCommand);

// Utility function to access current environment from global context
export function getCurrentEnvironment(): 'dev' | 'prod' {
  return ((global as any).__cryptoTrackerEnv as 'dev' | 'prod') || 'dev';
}

// Check configuration before running commands
program.hook('preAction', (thisCommand) => {
  // Extract and validate environment
  const envOption = thisCommand.opts().env as string;
  if (envOption && !['dev', 'prod'].includes(envOption)) {
    Logger.error(`Invalid environment: ${envOption}. Must be 'dev' or 'prod'`);
    process.exit(1);
  }

  // Store in global context for commands to access
  (global as any).__cryptoTrackerEnv = envOption as 'dev' | 'prod';

  // Warning for prod environment
  if (envOption === 'prod') {
    Logger.warn('Running in PRODUCTION environment');
  }


  // Commands that require API keys
  const requiresApiKeys = ['query', 'portfolio'];
  const commandName = thisCommand.args[0];

  // Only check API keys for commands that need them
  if (requiresApiKeys.includes(commandName)) {
    try {
      if (!configManager.isConfigured()) {
        Logger.error('API keys not configured. Please set them in .env or run: npm run init');
        process.exit(1);
      }
    } catch (error) {
      Logger.error('Configuration error. Please run: npm run init');
      process.exit(1);
    }
  }
});

// Global error handler
process.on('uncaughtException', (error) => {
  Logger.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (error: any) => {
  Logger.error(`Unhandled promise rejection: ${error?.message || String(error)}`);
  process.exit(1);
});

// Parse arguments
program.parse();
