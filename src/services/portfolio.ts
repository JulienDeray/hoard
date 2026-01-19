import type { HoldingWithAsset, HoldingWithValue } from '../models/index.js';
import type { LedgerRepository } from '../database/ledger.js';
import type { RatesRepository } from '../database/rates.js';
import type { CoinMarketCapService } from './coinmarketcap.js';
import { Logger } from '../utils/logger.js';

export interface PortfolioSummary {
  date: string;
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

      // If holding already has value_eur from the database, use it
      if (holding.value_eur !== undefined && holding.value_eur !== null) {
        price = holding.value_eur / holding.amount;
      } else if (date) {
        // Get historical price
        const historicalRate = this.ratesRepo.getHistoricalRate(
          holding.asset_symbol,
          date,
          this.baseCurrency
        );
        price = historicalRate?.price;
      } else {
        // Try cache first
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

      enriched.push({
        ...holding,
        current_price_eur: price,
        current_value_eur: price ? holding.amount * price : holding.value_eur,
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
}
