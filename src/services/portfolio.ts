import type { HoldingWithAsset, HoldingWithValue, PriceResult } from '../models/index.js';
import type { LedgerRepository } from '../database/ledger.js';
import type { RatesRepository } from '../database/rates.js';
import type { CoinMarketCapService } from './coinmarketcap.js';
import { Logger } from '../utils/logger.js';

export interface PortfolioSummary {
  date: string;
  snapshotId: number;
  holdings: HoldingWithValue[];
  totalValue: number;
  currency: string;
}

export class PortfolioService {
  constructor(
    private ledgerRepo: LedgerRepository,
    private ratesRepo: RatesRepository,
    private cmcService: CoinMarketCapService,
    private baseCurrency: string = 'EUR'
  ) {}

  async getPortfolioValue(date?: string): Promise<PortfolioSummary | null> {
    // Get holdings for the specified date or latest
    const holdings = date
      ? this.ledgerRepo.getHoldingsByDate(date)
      : this.ledgerRepo.getLatestHoldings();

    if (holdings.length === 0) {
      return null;
    }

    // Get the actual date of the snapshot
    const snapshot = date
      ? this.ledgerRepo.getSnapshotByDate(date)
      : this.ledgerRepo.getLatestSnapshot();

    if (!snapshot) {
      return null;
    }

    // Enrich holdings with current values
    const holdingsWithValues = await this.enrichHoldingsWithPrices(holdings, date || null);

    // Calculate total value
    const totalValue = holdingsWithValues.reduce((sum, h) => sum + (h.current_value_eur || 0), 0);

    return {
      date: snapshot.date,
      snapshotId: snapshot.id,
      holdings: holdingsWithValues,
      totalValue,
      currency: this.baseCurrency,
    };
  }

  async enrichHoldingsWithPrices(
    holdings: HoldingWithAsset[],
    date: string | null
  ): Promise<HoldingWithValue[]> {
    const enriched: HoldingWithValue[] = [];

    for (const holding of holdings) {
      let price: number | undefined;

      // Always try to get price from rates DB first (single source of truth)
      // This includes manual overrides stored with source='manual'
      if (date) {
        // Get historical price from rates DB
        const historicalRate = this.ratesRepo.getHistoricalRate(
          holding.asset_symbol,
          date,
          this.baseCurrency
        );
        price = historicalRate?.price;
      } else {
        // Try cache first for current prices
        const cached = this.ratesRepo.getCachedRate(holding.asset_symbol, this.baseCurrency);
        if (cached) {
          price = cached.price;
        } else {
          // Fetch current price from API
          try {
            price = await this.cmcService.getCurrentPrice(holding.asset_symbol, this.baseCurrency);
            // Update cache
            this.ratesRepo.updateCachedRate(holding.asset_symbol, price, this.baseCurrency);
          } catch (error) {
            Logger.error(
              `Failed to fetch price for ${holding.asset_symbol}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }

      // Only fall back to stored value_eur if no rate found (backwards compatibility)
      const fallbackValue =
        holding.value_eur !== undefined && holding.value_eur !== null
          ? holding.value_eur
          : undefined;

      enriched.push({
        ...holding,
        current_price_eur: price,
        current_value_eur: price ? holding.amount * price : fallbackValue,
      });
    }

    return enriched;
  }

  async fetchAndCachePrices(symbols: string[]): Promise<void> {
    try {
      const prices = await this.cmcService.getMultipleCurrentPrices(symbols, this.baseCurrency);

      for (const [symbol, price] of prices.entries()) {
        this.ratesRepo.updateCachedRate(symbol, price, this.baseCurrency);
      }

      Logger.success(`Updated prices for ${prices.size} assets`);
    } catch (error) {
      Logger.error(
        `Failed to fetch prices: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get current prices for multiple symbols
   * Checks cache first, fetches from CMC if missing
   */
  async getCurrentPrices(symbols: string[]): Promise<PriceResult[]> {
    const results: PriceResult[] = [];
    const now = new Date().toISOString();

    for (const symbol of symbols) {
      // Try cache first
      const cached = this.ratesRepo.getCachedRate(symbol, this.baseCurrency);

      if (cached) {
        results.push({
          symbol,
          price: cached.price,
          currency: this.baseCurrency,
          fromCache: true,
          timestamp: cached.last_updated,
        });
        continue;
      }

      // Fetch from API
      try {
        const price = await this.cmcService.getCurrentPrice(symbol, this.baseCurrency);
        this.ratesRepo.updateCachedRate(symbol, price, this.baseCurrency);

        results.push({
          symbol,
          price,
          currency: this.baseCurrency,
          fromCache: false,
          timestamp: now,
        });
      } catch (error) {
        results.push({
          symbol,
          currency: this.baseCurrency,
          fromCache: false,
          timestamp: now,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Force refresh prices from CoinMarketCap (bypass cache)
   */
  async refreshPrices(symbols: string[]): Promise<PriceResult[]> {
    const results: PriceResult[] = [];
    const now = new Date().toISOString();

    for (const symbol of symbols) {
      try {
        // Clear existing cache by fetching fresh
        const price = await this.cmcService.getCurrentPrice(symbol, this.baseCurrency);
        this.ratesRepo.updateCachedRate(symbol, price, this.baseCurrency);

        results.push({
          symbol,
          price,
          currency: this.baseCurrency,
          fromCache: false,
          timestamp: now,
        });
      } catch (error) {
        results.push({
          symbol,
          currency: this.baseCurrency,
          fromCache: false,
          timestamp: now,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}
