#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { snapshotCommand } from './commands/snapshot.js';
import { queryCommand } from './commands/query.js';
import { portfolioCommand } from './commands/portfolio.js';
import { configManager } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

// Load environment variables
config();

const program = new Command();

program
  .name('crypto-tracker')
  .description('CLI tool for tracking crypto assets with natural language queries')
  .version('0.1.0');

// Add commands
program.addCommand(snapshotCommand);
program.addCommand(queryCommand);
program.addCommand(portfolioCommand);

// Check configuration before running commands
program.hook('preAction', (thisCommand) => {
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
