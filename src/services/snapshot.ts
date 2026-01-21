/**
 * Snapshot Service
 *
 * Pure service functions for managing snapshots, holdings, and assets.
 * No CLI dependencies - accepts plain data, returns plain data, throws typed errors.
 */

import type { LedgerRepository } from '../database/ledger.js';
import type { RatesRepository } from '../database/rates.js';
import type { CoinMarketCapService, AssetInfo } from './coinmarketcap.js';
import type {
  Snapshot,
  HoldingWithAsset,
  Asset,
  Holding,
} from '../models/index.js';
import {
  SnapshotNotFoundError,
  SnapshotAlreadyExistsError,
  AssetDiscoveryError,
  HoldingNotFoundError,
  InvalidDateError,
  InvalidAmountError,
} from '../errors/index.js';
import { validateDate } from '../utils/validators.js';

// ============================================================================
// DTOs / Return types
// ============================================================================

export interface SnapshotExistsResult {
  exists: boolean;
  snapshot?: Snapshot;
  holdings: HoldingWithAsset[];
}

export interface SnapshotWithHoldings {
  snapshot: Snapshot;
  holdings: HoldingWithAsset[];
}

export interface ListSnapshotsOptions {
  /** Comma-separated list of asset symbols to filter */
  assets?: string;
  /** Show only the last N snapshots */
  last?: number;
}

export interface ListSnapshotsResult {
  snapshots: Array<{
    snapshot: Snapshot;
    holdingsMap: Map<string, number>;
  }>;
  /** All unique asset symbols across filtered snapshots */
  allAssetSymbols: string[];
  /** Asset symbols after applying asset filter */
  filteredAssetSymbols: string[];
  /** Total count of snapshots (before --last filter) */
  totalCount: number;
}

export interface GetOrCreateSnapshotResult {
  snapshot: Snapshot;
  isNew: boolean;
}

export interface AssetSearchResult {
  found: boolean;
  asset?: Asset;
  assetInfo?: AssetInfo;
}

export interface AddHoldingResult {
  holding: Holding | HoldingWithAsset;
  isUpdate: boolean;
}

export interface PriceFetchResult {
  symbol: string;
  price?: number;
  error?: string;
}

export interface DeleteHoldingResult {
  deletedHolding: HoldingWithAsset;
  remainingHoldings: HoldingWithAsset[];
}

export interface DeleteSnapshotResult {
  snapshot: Snapshot;
  deletedHoldingsCount: number;
}

export interface UpdateHoldingInput {
  amount?: number;
  valueEur?: number;
  notes?: string;
}

export interface UpdateHoldingResult {
  holding: HoldingWithAsset;
  previousAmount: number;
}

// ============================================================================
// Service class
// ============================================================================

export class SnapshotService {
  constructor(
    private ledgerRepo: LedgerRepository,
    private ratesRepo: RatesRepository,
    private cmcService: CoinMarketCapService,
    private baseCurrency: string = 'EUR'
  ) {}

  // ==========================================================================
  // Read operations
  // ==========================================================================

  /**
   * Check if a snapshot exists for the given date
   */
  checkSnapshotExists(date: string): SnapshotExistsResult {
    if (!validateDate(date)) {
      throw new InvalidDateError(date);
    }

    const snapshot = this.ledgerRepo.getSnapshotByDate(date);

    if (!snapshot) {
      return { exists: false, holdings: [] };
    }

    const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);

    return {
      exists: true,
      snapshot,
      holdings,
    };
  }

  /**
   * Get a snapshot by date with its holdings
   * @throws SnapshotNotFoundError if snapshot doesn't exist
   */
  getSnapshotByDate(date: string): SnapshotWithHoldings {
    if (!validateDate(date)) {
      throw new InvalidDateError(date);
    }

    const snapshot = this.ledgerRepo.getSnapshotByDate(date);

    if (!snapshot) {
      throw new SnapshotNotFoundError(date);
    }

    const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);

    return { snapshot, holdings };
  }

  /**
   * List all snapshots with filtering options
   */
  listSnapshots(options: ListSnapshotsOptions = {}): ListSnapshotsResult {
    const allSnapshots = this.ledgerRepo.listSnapshots();
    const totalCount = allSnapshots.length;

    if (allSnapshots.length === 0) {
      return {
        snapshots: [],
        allAssetSymbols: [],
        filteredAssetSymbols: [],
        totalCount: 0,
      };
    }

    // Apply --last filter (snapshots are returned in DESC order - newest first)
    let snapshots = allSnapshots;
    if (options.last && options.last > 0) {
      snapshots = snapshots.slice(0, options.last);
    }

    // Build snapshot data with holdings
    const allAssets = new Set<string>();
    const snapshotData = snapshots.map((snapshot) => {
      const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
      const holdingsMap = new Map(
        holdings.map((h) => {
          allAssets.add(h.asset_symbol);
          return [h.asset_symbol, h.amount];
        })
      );
      return { snapshot, holdingsMap };
    });

    // Apply --assets filter
    let assetSymbols = Array.from(allAssets).sort();
    if (options.assets) {
      const requestedAssets = options.assets.split(',').map((s) => s.trim().toUpperCase());
      assetSymbols = assetSymbols.filter((symbol) => requestedAssets.includes(symbol));
    }

    return {
      snapshots: snapshotData,
      allAssetSymbols: Array.from(allAssets).sort(),
      filteredAssetSymbols: assetSymbols,
      totalCount,
    };
  }

  // ==========================================================================
  // Create operations
  // ==========================================================================

  /**
   * Create a new snapshot
   * @throws SnapshotAlreadyExistsError if snapshot already exists for date
   */
  createSnapshot(date: string, notes?: string): Snapshot {
    if (!validateDate(date)) {
      throw new InvalidDateError(date);
    }

    const existing = this.checkSnapshotExists(date);
    if (existing.exists) {
      throw new SnapshotAlreadyExistsError(date, existing.holdings.length);
    }

    return this.ledgerRepo.createSnapshot({ date, notes });
  }

  /**
   * Get existing snapshot or create a new one
   */
  getOrCreateSnapshot(date: string, notes?: string): GetOrCreateSnapshotResult {
    if (!validateDate(date)) {
      throw new InvalidDateError(date);
    }

    const existing = this.ledgerRepo.getSnapshotByDate(date);

    if (existing) {
      return { snapshot: existing, isNew: false };
    }

    const snapshot = this.ledgerRepo.createSnapshot({ date, notes });
    return { snapshot, isNew: true };
  }

  // ==========================================================================
  // Asset operations
  // ==========================================================================

  /**
   * Get an asset by symbol
   */
  getAssetBySymbol(symbol: string): Asset | null {
    const asset = this.ledgerRepo.getAssetBySymbol(symbol.toUpperCase());
    return asset || null;
  }

  /**
   * List all assets
   */
  listAssets(): Asset[] {
    return this.ledgerRepo.listAssets();
  }

  /**
   * Search assets by symbol or name (prefix match)
   */
  searchAssets(query: string, limit: number = 10): Asset[] {
    const allAssets = this.ledgerRepo.listAssets();
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
      return allAssets.slice(0, limit);
    }

    const matches = allAssets.filter(
      (asset) =>
        asset.symbol.toLowerCase().startsWith(normalizedQuery) ||
        asset.name.toLowerCase().startsWith(normalizedQuery) ||
        asset.symbol.toLowerCase().includes(normalizedQuery) ||
        asset.name.toLowerCase().includes(normalizedQuery)
    );

    // Sort by relevance: exact matches first, then prefix matches, then contains
    matches.sort((a, b) => {
      const aSymbolExact = a.symbol.toLowerCase() === normalizedQuery;
      const bSymbolExact = b.symbol.toLowerCase() === normalizedQuery;
      if (aSymbolExact && !bSymbolExact) return -1;
      if (!aSymbolExact && bSymbolExact) return 1;

      const aSymbolPrefix = a.symbol.toLowerCase().startsWith(normalizedQuery);
      const bSymbolPrefix = b.symbol.toLowerCase().startsWith(normalizedQuery);
      if (aSymbolPrefix && !bSymbolPrefix) return -1;
      if (!aSymbolPrefix && bSymbolPrefix) return 1;

      return a.symbol.localeCompare(b.symbol);
    });

    return matches.slice(0, limit);
  }

  /**
   * Search for an asset by symbol using CoinMarketCap API
   */
  async searchAssetBySymbol(symbol: string): Promise<AssetSearchResult> {
    // First check if it exists locally
    const localAsset = this.getAssetBySymbol(symbol);
    if (localAsset) {
      return { found: true, asset: localAsset };
    }

    // Search CoinMarketCap
    try {
      const assetInfo = await this.cmcService.getAssetInfoBySymbol(symbol, this.baseCurrency);

      if (!assetInfo) {
        return { found: false };
      }

      return { found: true, assetInfo };
    } catch (error) {
      throw new AssetDiscoveryError(
        symbol,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Search for an asset by CoinMarketCap ID
   */
  async searchAssetById(cmcId: number): Promise<AssetSearchResult> {
    try {
      const assetInfo = await this.cmcService.getAssetInfoById(cmcId, this.baseCurrency);

      if (!assetInfo) {
        return { found: false };
      }

      // Check if we already have this asset locally
      const localAsset = this.getAssetBySymbol(assetInfo.symbol);
      if (localAsset) {
        return { found: true, asset: localAsset, assetInfo };
      }

      return { found: true, assetInfo };
    } catch (error) {
      throw new AssetDiscoveryError(
        `CMC ID ${cmcId}`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Create a new asset from CoinMarketCap asset info
   */
  createAssetFromInfo(assetInfo: AssetInfo): Asset {
    return this.ledgerRepo.createAsset({
      symbol: assetInfo.symbol,
      name: assetInfo.name,
      external_id: assetInfo.id.toString(),
      asset_class: 'CRYPTO',
      valuation_source: 'CMC',
    });
  }

  // ==========================================================================
  // Holding operations
  // ==========================================================================

  /**
   * Add a holding to a snapshot
   * If the holding already exists, it will be updated
   */
  addHolding(snapshotId: number, assetId: number, amount: number): AddHoldingResult {
    if (amount <= 0) {
      throw new InvalidAmountError(amount);
    }

    // Check if holding already exists for this asset in this snapshot
    const existingHoldings = this.ledgerRepo.getHoldingsBySnapshotId(snapshotId);
    const existingHolding = existingHoldings.find((h) => h.asset_id === assetId);

    if (existingHolding) {
      this.ledgerRepo.updateHolding(existingHolding.id, { amount });
      // Re-fetch to get updated data
      const updated = this.ledgerRepo.getHoldingById(existingHolding.id);
      return { holding: updated!, isUpdate: true };
    }

    const holding = this.ledgerRepo.createHolding({
      snapshot_id: snapshotId,
      asset_id: assetId,
      amount,
    });

    return { holding, isUpdate: false };
  }

  /**
   * Update the EUR value of a holding
   */
  updateHoldingValue(holdingId: number, valueEur: number): void {
    this.ledgerRepo.updateHolding(holdingId, { value_eur: valueEur });
  }

  /**
   * Get holdings for a snapshot by ID
   */
  getHoldingsBySnapshotId(snapshotId: number): HoldingWithAsset[] {
    return this.ledgerRepo.getHoldingsBySnapshotId(snapshotId);
  }

  /**
   * Update a holding by snapshot date and asset ID
   * @throws SnapshotNotFoundError if snapshot doesn't exist
   * @throws HoldingNotFoundError if holding doesn't exist in snapshot
   * @throws InvalidAmountError if amount is invalid
   */
  updateHolding(
    snapshotDate: string,
    assetId: number,
    input: UpdateHoldingInput
  ): UpdateHoldingResult {
    if (!validateDate(snapshotDate)) {
      throw new InvalidDateError(snapshotDate);
    }

    if (input.amount !== undefined && input.amount <= 0) {
      throw new InvalidAmountError(input.amount);
    }

    const snapshot = this.ledgerRepo.getSnapshotByDate(snapshotDate);
    if (!snapshot) {
      throw new SnapshotNotFoundError(snapshotDate);
    }

    const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
    const holding = holdings.find((h) => h.asset_id === assetId);

    if (!holding) {
      // Get asset symbol for error message
      const asset = this.ledgerRepo.getAssetById(assetId);
      const symbol = asset?.symbol || `ID:${assetId}`;
      throw new HoldingNotFoundError(symbol, snapshotDate);
    }

    const previousAmount = holding.amount;

    // Build updates object
    const updates: { amount?: number; value_eur?: number; notes?: string } = {};
    if (input.amount !== undefined) updates.amount = input.amount;
    if (input.valueEur !== undefined) updates.value_eur = input.valueEur;
    if (input.notes !== undefined) updates.notes = input.notes;

    // Update the holding
    this.ledgerRepo.updateHolding(holding.id, updates);

    // Fetch updated holding
    const updatedHoldings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
    const updatedHolding = updatedHoldings.find((h) => h.asset_id === assetId)!;

    return {
      holding: updatedHolding,
      previousAmount,
    };
  }

  // ==========================================================================
  // Price operations
  // ==========================================================================

  /**
   * Fetch and cache the current price for a symbol
   */
  async fetchAndCachePrice(symbol: string): Promise<PriceFetchResult> {
    try {
      const price = await this.cmcService.getCurrentPrice(symbol, this.baseCurrency);

      // Update cache
      this.ratesRepo.updateCachedRate(symbol, price, this.baseCurrency);

      return { symbol, price };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { symbol, error: errorMessage };
    }
  }

  /**
   * Fetch prices for multiple symbols and cache them
   */
  async fetchAndCachePrices(symbols: string[]): Promise<PriceFetchResult[]> {
    const results: PriceFetchResult[] = [];

    for (const symbol of symbols) {
      const result = await this.fetchAndCachePrice(symbol);
      results.push(result);
    }

    return results;
  }

  /**
   * Update holding values based on current prices
   */
  async updateHoldingValues(snapshotId: number): Promise<void> {
    const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshotId);

    for (const holding of holdings) {
      const result = await this.fetchAndCachePrice(holding.asset_symbol);

      if (result.price) {
        const valueEur = holding.amount * result.price;
        this.ledgerRepo.updateHolding(holding.id, { value_eur: valueEur });
      }
    }
  }

  // ==========================================================================
  // Delete operations
  // ==========================================================================

  /**
   * Delete a specific holding from a snapshot
   * @throws SnapshotNotFoundError if snapshot doesn't exist
   * @throws HoldingNotFoundError if holding doesn't exist in snapshot
   */
  deleteHolding(snapshotDate: string, assetSymbol: string): DeleteHoldingResult {
    if (!validateDate(snapshotDate)) {
      throw new InvalidDateError(snapshotDate);
    }

    const snapshot = this.ledgerRepo.getSnapshotByDate(snapshotDate);
    if (!snapshot) {
      throw new SnapshotNotFoundError(snapshotDate);
    }

    const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
    const normalizedSymbol = assetSymbol.toUpperCase().trim();
    const holding = holdings.find((h) => h.asset_symbol === normalizedSymbol);

    if (!holding) {
      throw new HoldingNotFoundError(normalizedSymbol, snapshotDate);
    }

    // Delete the holding
    this.ledgerRepo.deleteHolding(holding.id);

    // Get remaining holdings
    const remainingHoldings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);

    return {
      deletedHolding: holding,
      remainingHoldings,
    };
  }

  /**
   * Delete an entire snapshot and all its holdings
   * @throws SnapshotNotFoundError if snapshot doesn't exist
   */
  deleteSnapshot(date: string): DeleteSnapshotResult {
    if (!validateDate(date)) {
      throw new InvalidDateError(date);
    }

    const snapshot = this.ledgerRepo.getSnapshotByDate(date);
    if (!snapshot) {
      throw new SnapshotNotFoundError(date);
    }

    const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
    const holdingsCount = holdings.length;

    // Delete snapshot (cascade deletes holdings)
    this.ledgerRepo.deleteSnapshot(snapshot.id);

    return {
      snapshot,
      deletedHoldingsCount: holdingsCount,
    };
  }

  /**
   * Get available assets in a snapshot for display (useful for error messages)
   */
  getAvailableAssetsInSnapshot(snapshotDate: string): string[] {
    const snapshot = this.ledgerRepo.getSnapshotByDate(snapshotDate);
    if (!snapshot) {
      return [];
    }

    const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
    return holdings.map((h) => h.asset_symbol);
  }
}
