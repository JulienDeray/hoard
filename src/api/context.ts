/**
 * API Context
 *
 * Initializes services and decorates Fastify instance with shared dependencies.
 */

import type { FastifyInstance } from 'fastify';
import { DatabaseManager } from '../database/connection.js';
import { LedgerRepository } from '../database/ledger.js';
import { RatesRepository } from '../database/rates.js';
import { CoinMarketCapService } from '../services/coinmarketcap.js';
import { SnapshotService } from '../services/snapshot.js';
import { AllocationTargetService } from '../services/allocation-target.js';
import { AllocationService } from '../services/allocation.js';
import { PortfolioService } from '../services/portfolio.js';
import { LiabilityService } from '../services/liability.js';
import { PropertyService } from '../services/property.js';
import { configManager } from '../utils/config.js';

export interface ApiServices {
  snapshotService: SnapshotService;
  allocationTargetService: AllocationTargetService;
  allocationService: AllocationService;
  portfolioService: PortfolioService;
  liabilityService: LiabilityService;
  propertyService: PropertyService;
  ledgerRepo: LedgerRepository;
  ratesRepo: RatesRepository;
}

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    services: ApiServices;
  }
}

export interface InitializeContextOptions {
  env: 'dev' | 'prod';
}

/**
 * Initialize all services and decorate the Fastify instance
 */
export async function initializeContext(
  fastify: FastifyInstance,
  options: InitializeContextOptions
): Promise<void> {
  const { env } = options;

  // Get environment-specific config
  const config = configManager.getWithEnvironment(env);

  // Initialize database connections
  const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
  const ratesDb = DatabaseManager.getRatesDb(config.database.ratesPath);

  // Initialize repositories
  const ledgerRepo = new LedgerRepository(ledgerDb);
  const ratesRepo = new RatesRepository(ratesDb);

  // Initialize external services
  const cmcService = new CoinMarketCapService(config.api.coinmarketcap.apiKey);

  // Initialize domain services
  const baseCurrency = 'EUR';

  const snapshotService = new SnapshotService(ledgerRepo, ratesRepo, cmcService, baseCurrency);

  const allocationTargetService = new AllocationTargetService(ledgerRepo);

  const portfolioService = new PortfolioService(ledgerRepo, ratesRepo, cmcService, baseCurrency);

  const allocationService = new AllocationService(ledgerRepo, portfolioService);

  const liabilityService = new LiabilityService(ledgerRepo);

  const propertyService = new PropertyService(ledgerRepo, ratesRepo, baseCurrency);

  // Decorate Fastify with services
  const services: ApiServices = {
    snapshotService,
    allocationTargetService,
    allocationService,
    portfolioService,
    liabilityService,
    propertyService,
    ledgerRepo,
    ratesRepo,
  };

  fastify.decorate('services', services);

  // Cleanup on close
  fastify.addHook('onClose', () => {
    DatabaseManager.closeAll();
  });
}
