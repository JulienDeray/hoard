import type Database from 'better-sqlite3';
import type { HistoricalRate, RateCache, SaveRateInput } from '../models/index.js';

export class RatesRepository {
  constructor(
    private db: Database.Database,
    private cacheTTLMinutes: number = 5
  ) {}

  // Historical rates operations
  saveHistoricalRate(input: SaveRateInput): HistoricalRate {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO historical_rates (
        asset_symbol, base_currency, price, timestamp,
        volume_24h, market_cap, source
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.asset_symbol,
      input.base_currency || 'EUR',
      input.price,
      input.timestamp,
      input.volume_24h || null,
      input.market_cap || null,
      input.source || 'coinmarketcap'
    );

    return this.getHistoricalRateById(Number(result.lastInsertRowid))!;
  }

  getHistoricalRateById(id: number): HistoricalRate | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM historical_rates WHERE id = ?
    `);

    return stmt.get(id) as HistoricalRate | undefined;
  }

  getHistoricalRate(
    symbol: string,
    date: string,
    baseCurrency = 'EUR'
  ): HistoricalRate | undefined {
    // Try to find exact match first
    const exact = this.db.prepare(`
      SELECT * FROM historical_rates
      WHERE asset_symbol = ? AND base_currency = ?
      AND DATE(timestamp) = DATE(?)
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    const exactResult = exact.get(symbol, baseCurrency, date) as HistoricalRate | undefined;
    if (exactResult) return exactResult;

    // If no exact match, find the closest rate before this date
    const closest = this.db.prepare(`
      SELECT * FROM historical_rates
      WHERE asset_symbol = ? AND base_currency = ?
      AND DATE(timestamp) <= DATE(?)
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    return closest.get(symbol, baseCurrency, date) as HistoricalRate | undefined;
  }

  getHistoricalRatesForAsset(
    symbol: string,
    baseCurrency = 'EUR',
    limit = 100
  ): HistoricalRate[] {
    const stmt = this.db.prepare(`
      SELECT * FROM historical_rates
      WHERE asset_symbol = ? AND base_currency = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(symbol, baseCurrency, limit) as HistoricalRate[];
  }

  getHistoricalRatesRange(
    symbol: string,
    startDate: string,
    endDate: string,
    baseCurrency = 'EUR'
  ): HistoricalRate[] {
    const stmt = this.db.prepare(`
      SELECT * FROM historical_rates
      WHERE asset_symbol = ? AND base_currency = ?
      AND DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
      ORDER BY timestamp ASC
    `);

    return stmt.all(symbol, baseCurrency, startDate, endDate) as HistoricalRate[];
  }

  /**
   * Get the most recent historical rate for a symbol (regardless of date).
   * Useful as a fallback when cache is expired but we have historical data.
   */
  getLatestHistoricalRate(
    symbol: string,
    baseCurrency = 'EUR'
  ): HistoricalRate | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM historical_rates
      WHERE asset_symbol = ? AND base_currency = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    return stmt.get(symbol, baseCurrency) as HistoricalRate | undefined;
  }

  // Rate cache operations
  getCachedRate(symbol: string, baseCurrency = 'EUR'): RateCache | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM rate_cache
      WHERE asset_symbol = ? AND base_currency = ?
    `);

    const result = stmt.get(symbol, baseCurrency) as RateCache | undefined;

    if (!result) return undefined;

    // Check if cache is still valid (TTL check)
    const lastUpdated = new Date(result.last_updated);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);

    if (diffMinutes > this.cacheTTLMinutes) {
      // Cache expired, remove it
      this.deleteCachedRate(symbol, baseCurrency);
      return undefined;
    }

    return result;
  }

  updateCachedRate(symbol: string, price: number, baseCurrency = 'EUR'): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO rate_cache (
        asset_symbol, base_currency, price, last_updated
      )
      VALUES (?, ?, ?, datetime('now'))
    `);

    stmt.run(symbol, baseCurrency, price);

    // Also save to historical rates
    this.saveHistoricalRate({
      asset_symbol: symbol,
      base_currency: baseCurrency,
      price,
      timestamp: new Date().toISOString(),
    });
  }

  deleteCachedRate(symbol: string, baseCurrency = 'EUR'): void {
    const stmt = this.db.prepare(`
      DELETE FROM rate_cache
      WHERE asset_symbol = ? AND base_currency = ?
    `);

    stmt.run(symbol, baseCurrency);
  }

  clearCache(): void {
    const stmt = this.db.prepare('DELETE FROM rate_cache');
    stmt.run();
  }

  // Utility methods
  getOrFetchRate(
    symbol: string,
    date: string | null,
    baseCurrency = 'EUR'
  ): number | undefined {
    if (!date) {
      // Get current price from cache
      const cached = this.getCachedRate(symbol, baseCurrency);
      return cached?.price;
    }

    // Get historical price
    const historical = this.getHistoricalRate(symbol, date, baseCurrency);
    return historical?.price;
  }

  hasRateForDate(symbol: string, date: string, baseCurrency = 'EUR'): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM historical_rates
      WHERE asset_symbol = ? AND base_currency = ?
      AND DATE(timestamp) = DATE(?)
    `);

    const result = stmt.get(symbol, baseCurrency, date) as { count: number };
    return result.count > 0;
  }
}
