/**
 * Property Service
 *
 * Handles real estate property management including:
 * - Property creation with optional linked mortgages
 * - Property valuation updates with cache invalidation
 * - Equity calculations (Property Value - Mortgage Balance)
 * - Real estate portfolio summary
 */

import type { LedgerRepository } from '../database/ledger.js';
import type { RatesRepository } from '../database/rates.js';
import type { Asset } from '../models/index.js';
import type {
  PropertyType,
  PropertyMetadata,
  PropertyWithEquity,
  CreatePropertyInput,
  UpdatePropertyInput,
  UpdatePropertyValueInput,
  RealEstateSummary,
} from '../models/property.js';
import {
  PropertyNotFoundError,
  InvalidPropertyTypeError,
  InvalidPropertyValueError,
} from '../errors/index.js';

const VALID_PROPERTY_TYPES: PropertyType[] = [
  'PRIMARY_RESIDENCE',
  'RENTAL',
  'VACATION',
  'COMMERCIAL',
  'LAND',
  'OTHER',
];

export class PropertyService {
  constructor(
    private ledgerRepo: LedgerRepository,
    private ratesRepo: RatesRepository,
    private baseCurrency: string = 'EUR'
  ) {}

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Generate a unique symbol for a property
   * Format: PROP-{CITY/NAME}-{COUNTER}
   */
  private generatePropertySymbol(name: string, city?: string): string {
    // Get existing property symbols to determine counter
    const existingProperties = this.ledgerRepo.listRealEstateAssets(false);

    // Use city if provided, otherwise use first word of name
    const baseText = city || name.split(' ')[0] || 'PROPERTY';
    const sanitized = baseText
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 10);

    // Find the highest counter for this base
    const prefix = `PROP-${sanitized}-`;
    let maxCounter = 0;
    for (const prop of existingProperties) {
      if (prop.symbol.startsWith(prefix)) {
        const counterStr = prop.symbol.substring(prefix.length);
        const counter = parseInt(counterStr, 10);
        if (!isNaN(counter) && counter > maxCounter) {
          maxCounter = counter;
        }
      }
    }

    return `${prefix}${String(maxCounter + 1).padStart(3, '0')}`;
  }

  /**
   * Parse property metadata from JSON string
   */
  private parseMetadata(metadataJson?: string): PropertyMetadata | null {
    if (!metadataJson) return null;
    try {
      return JSON.parse(metadataJson) as PropertyMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Get the current value of a property from the rates DB
   */
  private getPropertyValue(symbol: string): number {
    // First try to get the latest cached rate
    const cached = this.ratesRepo.getCachedRate(symbol, this.baseCurrency);
    if (cached) {
      return cached.price;
    }

    // Fall back to most recent historical rate
    const historical = this.ratesRepo.getHistoricalRatesForAsset(symbol, this.baseCurrency, 1);
    if (historical.length > 0) {
      return historical[0].price;
    }

    return 0;
  }

  /**
   * Convert an asset to PropertyWithEquity
   */
  private assetToPropertyWithEquity(asset: Asset): PropertyWithEquity {
    const metadata = this.parseMetadata(asset.metadata);
    if (!metadata) {
      throw new PropertyNotFoundError(asset.id);
    }

    const currentValue = this.getPropertyValue(asset.symbol);

    // Get linked mortgage if any
    const mortgage = this.ledgerRepo.getMortgageByLinkedAsset(asset.id);
    let mortgageBalance: number | null = null;
    let mortgageId: number | null = null;

    if (mortgage) {
      mortgageId = mortgage.id;
      const latestBalance = this.ledgerRepo.getLatestMortgageBalance(mortgage.id);
      // Use snapshot balance if available, otherwise fall back to original amount
      mortgageBalance = latestBalance?.outstanding_amount ?? mortgage.original_amount;
    }

    const equity = currentValue - (mortgageBalance ?? 0);
    const ltvPercentage = currentValue > 0 && mortgageBalance !== null
      ? (mortgageBalance / currentValue) * 100
      : null;

    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      metadata,
      currentValue,
      mortgageBalance,
      mortgageId,
      equity,
      ltvPercentage,
      currency: asset.currency,
    };
  }

  // ============================================================================
  // Validation
  // ============================================================================

  private validatePropertyType(propertyType: string): asserts propertyType is PropertyType {
    if (!VALID_PROPERTY_TYPES.includes(propertyType as PropertyType)) {
      throw new InvalidPropertyTypeError(propertyType);
    }
  }

  private validatePropertyValue(value: number): void {
    if (value <= 0 || !Number.isFinite(value)) {
      throw new InvalidPropertyValueError(value);
    }
  }

  // ============================================================================
  // Create operations
  // ============================================================================

  /**
   * Create a new property with optional linked mortgage
   *
   * Steps:
   * 1. Create asset with REAL_ESTATE class and metadata
   * 2. Store initial valuation in rates DB
   * 3. If mortgage provided, create liability and link it
   */
  create(input: CreatePropertyInput): PropertyWithEquity {
    this.validatePropertyType(input.propertyType);
    this.validatePropertyValue(input.currentValue);

    // Build metadata
    const metadata: PropertyMetadata = {
      propertyType: input.propertyType,
      address: input.address,
      city: input.city,
      country: input.country,
      purchaseDate: input.purchaseDate,
      purchasePrice: input.purchasePrice,
      squareMeters: input.squareMeters,
      rooms: input.rooms,
      rentalIncome: input.rentalIncome,
    };

    // Generate symbol
    const symbol = this.generatePropertySymbol(input.name, input.city);

    // Create asset
    const asset = this.ledgerRepo.createAsset({
      symbol,
      name: input.name,
      asset_class: 'REAL_ESTATE',
      valuation_source: 'MANUAL',
      currency: input.currency || this.baseCurrency,
      metadata: JSON.stringify(metadata),
    });

    // Store initial valuation in rates DB
    this.ratesRepo.saveHistoricalRate({
      asset_symbol: symbol,
      base_currency: this.baseCurrency,
      price: input.currentValue,
      timestamp: new Date().toISOString(),
      source: 'manual',
    });

    // Update the rate cache as well
    this.ratesRepo.updateCachedRate(symbol, input.currentValue, this.baseCurrency);

    // Create linked mortgage if provided
    if (input.mortgage) {
      const liability = this.ledgerRepo.createLiability({
        name: input.mortgage.name,
        liability_type: 'MORTGAGE',
        linked_asset_id: asset.id,
        original_amount: input.mortgage.originalAmount,
        currency: input.currency || this.baseCurrency,
        interest_rate: input.mortgage.interestRate,
        start_date: input.mortgage.startDate,
        term_months: input.mortgage.termMonths,
      });

      // If there's a latest snapshot, add the initial outstanding balance to it
      // This ensures the mortgage balance shows up immediately in the UI
      const latestSnapshot = this.ledgerRepo.getLatestSnapshot();
      if (latestSnapshot) {
        this.ledgerRepo.createLiabilityBalance({
          snapshot_id: latestSnapshot.id,
          liability_id: liability.id,
          outstanding_amount: input.mortgage.outstandingAmount,
        });
        // Invalidate the snapshot cache since we added a liability balance
        this.ledgerRepo.invalidateSnapshotCache(latestSnapshot.id);
      }
    }

    return this.assetToPropertyWithEquity(asset);
  }

  // ============================================================================
  // Read operations
  // ============================================================================

  /**
   * List all properties with equity calculations
   */
  list(): PropertyWithEquity[] {
    const realEstateAssets = this.ledgerRepo.listRealEstateAssets(true);
    return realEstateAssets.map((asset) => this.assetToPropertyWithEquity(asset));
  }

  /**
   * Get a property by ID with equity calculation
   * @throws PropertyNotFoundError if property not found or not a real estate asset
   */
  getById(id: number): PropertyWithEquity {
    const asset = this.ledgerRepo.getAssetById(id);

    if (!asset || asset.asset_class !== 'REAL_ESTATE') {
      throw new PropertyNotFoundError(id);
    }

    return this.assetToPropertyWithEquity(asset);
  }

  /**
   * Get a property by symbol
   * @throws PropertyNotFoundError if property not found
   */
  getBySymbol(symbol: string): PropertyWithEquity {
    const asset = this.ledgerRepo.getAssetBySymbol(symbol);

    if (!asset || asset.asset_class !== 'REAL_ESTATE') {
      throw new PropertyNotFoundError(-1);
    }

    return this.assetToPropertyWithEquity(asset);
  }

  // ============================================================================
  // Update operations
  // ============================================================================

  /**
   * Update property metadata (name, address, etc.)
   * @throws PropertyNotFoundError if property not found
   */
  update(id: number, input: UpdatePropertyInput): PropertyWithEquity {
    const asset = this.ledgerRepo.getAssetById(id);

    if (!asset || asset.asset_class !== 'REAL_ESTATE') {
      throw new PropertyNotFoundError(id);
    }

    if (input.propertyType) {
      this.validatePropertyType(input.propertyType);
    }

    // Merge existing metadata with updates
    const existingMetadata = this.parseMetadata(asset.metadata) || {} as PropertyMetadata;
    const updatedMetadata: PropertyMetadata = {
      ...existingMetadata,
      ...(input.propertyType !== undefined && { propertyType: input.propertyType }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.purchaseDate !== undefined && { purchaseDate: input.purchaseDate }),
      ...(input.purchasePrice !== undefined && { purchasePrice: input.purchasePrice }),
      ...(input.squareMeters !== undefined && { squareMeters: input.squareMeters }),
      ...(input.rooms !== undefined && { rooms: input.rooms }),
      ...(input.rentalIncome !== undefined && { rentalIncome: input.rentalIncome }),
    };

    // Update asset
    this.ledgerRepo.updateAsset(id, {
      ...(input.name !== undefined && { name: input.name }),
      metadata: JSON.stringify(updatedMetadata),
    });

    // Return updated property
    const updatedAsset = this.ledgerRepo.getAssetById(id)!;
    return this.assetToPropertyWithEquity(updatedAsset);
  }

  /**
   * Update property valuation
   * Stores in rates DB and invalidates cache for all snapshots containing this property
   *
   * @throws PropertyNotFoundError if property not found
   * @throws InvalidPropertyValueError if value is invalid
   */
  updateValue(id: number, input: UpdatePropertyValueInput): PropertyWithEquity {
    const asset = this.ledgerRepo.getAssetById(id);

    if (!asset || asset.asset_class !== 'REAL_ESTATE') {
      throw new PropertyNotFoundError(id);
    }

    this.validatePropertyValue(input.value);

    const timestamp = input.valuationDate
      ? new Date(input.valuationDate).toISOString()
      : new Date().toISOString();

    // Store new valuation in rates DB
    this.ratesRepo.saveHistoricalRate({
      asset_symbol: asset.symbol,
      base_currency: this.baseCurrency,
      price: input.value,
      timestamp,
      source: 'manual',
    });

    // Update the rate cache
    this.ratesRepo.updateCachedRate(asset.symbol, input.value, this.baseCurrency);

    // Invalidate snapshot cache for ALL snapshots containing this property
    this.ledgerRepo.invalidateSnapshotCacheForAsset(id);

    // Return updated property
    return this.assetToPropertyWithEquity(asset);
  }

  // ============================================================================
  // Summary operations
  // ============================================================================

  /**
   * Get aggregated real estate summary for portfolio
   */
  getRealEstateSummary(): RealEstateSummary {
    const properties = this.list();

    const totalPropertyValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
    const totalMortgageBalance = properties.reduce(
      (sum, p) => sum + (p.mortgageBalance ?? 0),
      0
    );
    const totalEquity = totalPropertyValue - totalMortgageBalance;

    return {
      totalPropertyValue,
      totalMortgageBalance,
      totalEquity,
      propertyCount: properties.length,
      properties,
    };
  }
}
