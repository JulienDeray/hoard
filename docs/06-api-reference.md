# API Reference

Detailed reference for Hoard's service layer, repositories, and errors.

## Table of Contents

1. [Service Interfaces](#service-interfaces)
2. [Repository Methods](#repository-methods)
3. [Error Classes & Codes](#error-classes--codes)

---

## Service Interfaces

### SnapshotService

Manages snapshots, holdings, and asset operations.

**Constructor:**

```typescript
constructor(
  ledgerRepo: LedgerRepository,
  ratesRepo: RatesRepository,
  cmcService: CoinMarketCapService,
  baseCurrency: string = 'EUR'
)
```

#### Snapshot Operations

| Method | Parameters | Returns | Throws |
|--------|------------|---------|--------|
| `checkSnapshotExists` | `date: string` | `SnapshotExistsResult` | `InvalidDateError` |
| `getSnapshotByDate` | `date: string` | `SnapshotWithHoldings` | `InvalidDateError`, `SnapshotNotFoundError` |
| `listSnapshots` | `options?: ListSnapshotsOptions` | `ListSnapshotsResult` | - |
| `getLatestSnapshot` | - | `Snapshot \| null` | - |
| `createSnapshot` | `date: string, notes?: string` | `Snapshot` | `InvalidDateError`, `SnapshotAlreadyExistsError` |
| `getOrCreateSnapshot` | `date: string, notes?: string` | `GetOrCreateSnapshotResult` | `InvalidDateError` |
| `deleteSnapshot` | `date: string` | `DeleteSnapshotResult` | `InvalidDateError`, `SnapshotNotFoundError` |

**Example:**

```typescript
const service = new SnapshotService(ledgerRepo, ratesRepo, cmcService);

// Check if snapshot exists
const result = service.checkSnapshotExists('2025-01-22');
if (result.exists) {
  console.log(`Found ${result.holdings.length} holdings`);
}

// Get or create
const { snapshot, isNew } = service.getOrCreateSnapshot('2025-01-22');
```

#### Holding Operations

| Method | Parameters | Returns | Throws |
|--------|------------|---------|--------|
| `addHolding` | `snapshotId: number, assetId: number, amount: number` | `AddHoldingResult` | `InvalidAmountError` |
| `getHoldingsBySnapshotId` | `snapshotId: number` | `HoldingWithAsset[]` | - |
| `updateHolding` | `date: string, assetId: number, input: UpdateHoldingInput` | `UpdateHoldingResult` | Multiple |
| `deleteHolding` | `date: string, assetSymbol: string` | `DeleteHoldingResult` | Multiple |

#### Asset Operations

| Method | Parameters | Returns | Throws |
|--------|------------|---------|--------|
| `getAssetBySymbol` | `symbol: string` | `Asset \| null` | - |
| `listAssets` | - | `Asset[]` | - |
| `searchAssets` | `query: string, limit?: number` | `Asset[]` | - |
| `searchAssetBySymbol` | `symbol: string` | `Promise<AssetSearchResult>` | `AssetDiscoveryError` |
| `createAssetFromInfo` | `assetInfo: AssetInfo` | `Asset` | - |

#### Liability Balance Operations

| Method | Parameters | Returns | Throws |
|--------|------------|---------|--------|
| `getLiabilityBalances` | `snapshotDate: string` | `LiabilityBalanceWithDetails[]` | Multiple |
| `addLiabilityBalance` | `date: string, liabilityId: number, amount: number` | `AddLiabilityBalanceResult` | Multiple |
| `updateLiabilityBalance` | `date: string, liabilityId: number, amount: number` | `UpdateLiabilityBalanceResult` | Multiple |
| `deleteLiabilityBalance` | `date: string, liabilityId: number` | `void` | Multiple |

---

### PortfolioService

Calculates portfolio values with price enrichment.

**Constructor:**

```typescript
constructor(
  ledgerRepo: LedgerRepository,
  ratesRepo: RatesRepository,
  cmcService: CoinMarketCapService,
  baseCurrency: string = 'EUR'
)
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getPortfolioValue` | `date?: string` | `Promise<PortfolioSummary \| null>` | Get portfolio value for date or current |
| `enrichHoldingsWithPrices` | `holdings: HoldingWithAsset[], date: string \| null` | `Promise<HoldingWithValue[]>` | Add price data to holdings |
| `fetchAndCachePrices` | `symbols: string[]` | `Promise<void>` | Fetch and cache prices from CMC |
| `getCurrentPrices` | `symbols: string[]` | `Promise<PriceResult[]>` | Get current prices (cache or API) |
| `refreshPrices` | `symbols: string[]` | `Promise<PriceResult[]>` | Force refresh from API |

**Return Types:**

```typescript
interface PortfolioSummary {
  date: string;
  snapshotId: number;
  holdings: HoldingWithValue[];
  totalValue: number;
  currency: string;
}

interface HoldingWithValue extends HoldingWithAsset {
  current_price_eur?: number;
  current_value_eur?: number;
  current_percentage?: number;
}
```

**Example:**

```typescript
const portfolio = await portfolioService.getPortfolioValue('2025-01-22');
if (portfolio) {
  console.log(`Total: €${portfolio.totalValue}`);
  portfolio.holdings.forEach(h => {
    console.log(`${h.asset_symbol}: €${h.current_value_eur}`);
  });
}
```

---

### AllocationService

Compares portfolio allocation vs targets.

**Constructor:**

```typescript
constructor(
  ledgerRepo: LedgerRepository,
  portfolioService: PortfolioService
)
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getAllocationSummary` | `date?: string` | `Promise<AllocationSummary \| null>` | Compare current vs targets |
| `getRebalancingSuggestions` | `date?: string, tolerance?: number` | `Promise<RebalancingSuggestion \| null>` | Get buy/sell actions |

**Return Types:**

```typescript
interface AllocationSummary {
  date: string;
  total_value: number;
  currency: string;
  allocations: AllocationComparison[];
  has_targets: boolean;
  targets_sum_valid: boolean;
}

interface AllocationComparison {
  target_type: AllocationTargetType;
  target_key: string;
  display_name: string;
  current_value: number;
  current_percentage: number;
  target_percentage: number;
  tolerance_pct: number;
  difference_percentage: number;
  difference_value: number;
  is_within_tolerance: boolean;
}

interface RebalancingSuggestion {
  date: string;
  total_value: number;
  currency: string;
  actions: RebalancingAction[];
  is_balanced: boolean;
}

interface RebalancingAction {
  target_key: string;
  display_name: string;
  action: 'buy' | 'sell' | 'hold';
  amount_eur: number;
  current_percentage: number;
  target_percentage: number;
}
```

---

### AllocationTargetService

Manages portfolio allocation targets.

**Constructor:**

```typescript
constructor(ledgerRepo: LedgerRepository)
```

#### Methods

| Method | Parameters | Returns | Throws |
|--------|------------|---------|--------|
| `listTargets` | - | `AllocationTarget[]` | - |
| `hasTargets` | - | `boolean` | - |
| `validateTargets` | - | `AllocationTargetValidation` | - |
| `validateTargetList` | `targets: CreateAllocationTargetInput[], allowInvalidSum?: boolean` | `AllocationTargetValidation` | `DuplicateAllocationTargetError`, `AllocationTargetsSumError` |
| `setTargets` | `options: SetTargetsOptions` | `SetTargetsResult` | Multiple |
| `clearTargets` | - | `number` | `NoAllocationTargetsError` |
| `calculateRemainingPercentage` | `targets: {target_percentage: number}[]` | `number` | - |

---

### CoinMarketCapService

External API client with rate limiting.

**Constructor:**

```typescript
constructor(apiKey: string)
```

**Features:**
- Request queue with 1-second delay between calls
- Handles both array and single object API responses

#### Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getCurrentPrice` | `symbol: string, baseCurrency?: string` | `Promise<number>` | Get current price |
| `getCurrentPriceData` | `symbol: string, baseCurrency?: string` | `Promise<PriceData>` | Get price + volume + market cap |
| `getMultipleCurrentPrices` | `symbols: string[], baseCurrency?: string` | `Promise<Map<string, number>>` | Get multiple prices (single API call) |
| `getHistoricalPrice` | `symbol: string, date: Date, baseCurrency?: string` | `Promise<number \| undefined>` | Get historical price |
| `backfillHistoricalRates` | `symbol: string, startDate: Date, endDate: Date, baseCurrency?: string` | `Promise<PriceData[]>` | Fetch date range |
| `getAssetInfoBySymbol` | `symbol: string, baseCurrency?: string` | `Promise<AssetInfo \| null>` | Get asset metadata |
| `getAssetInfoById` | `cmcId: number, baseCurrency?: string` | `Promise<AssetInfo \| null>` | Get asset by CMC ID |

---

## Repository Methods

### LedgerRepository

Low-level database access for ledger data.

**Constructor:**

```typescript
constructor(db: Database.Database)
```

#### Snapshot Operations

| Method | Signature | Returns |
|--------|-----------|---------|
| `createSnapshot` | `(input: CreateSnapshotInput) => Snapshot` | Single |
| `getSnapshotById` | `(id: number) => Snapshot \| undefined` | Single |
| `getSnapshotByDate` | `(date: string) => Snapshot \| undefined` | Single |
| `getLatestSnapshot` | `() => Snapshot \| undefined` | Single |
| `listSnapshots` | `() => Snapshot[]` | Array |
| `updateSnapshot` | `(id: number, updates: UpdateSnapshotInput) => void` | - |
| `deleteSnapshot` | `(id: number) => void` | - |

#### Holding Operations

| Method | Signature | Returns |
|--------|-----------|---------|
| `createHolding` | `(input: CreateHoldingInput) => Holding` | Single |
| `getHoldingById` | `(id: number) => Holding \| undefined` | Single |
| `getHoldingsBySnapshotId` | `(snapshotId: number) => HoldingWithAsset[]` | Array |
| `getHoldingsByDate` | `(date: string) => HoldingWithAsset[]` | Array |
| `getLatestHoldings` | `() => HoldingWithAsset[]` | Array |
| `updateHolding` | `(id: number, updates: UpdateHoldingInput) => void` | - |
| `deleteHolding` | `(id: number) => void` | - |

#### Asset Operations

| Method | Signature | Returns |
|--------|-----------|---------|
| `createAsset` | `(input: CreateAssetInput) => Asset` | Single |
| `getAssetById` | `(id: number) => Asset \| undefined` | Single |
| `getAssetBySymbol` | `(symbol: string) => Asset \| undefined` | Single |
| `listAssets` | `(activeOnly?: boolean) => Asset[]` | Array |
| `listAssetsByClass` | `(assetClass: string, activeOnly?: boolean) => Asset[]` | Array |
| `listRealEstateAssets` | `(activeOnly?: boolean) => Asset[]` | Array |
| `updateAsset` | `(id: number, updates: UpdateAssetInput) => void` | - |

#### Allocation Target Operations

| Method | Signature | Returns |
|--------|-----------|---------|
| `createAllocationTarget` | `(input: CreateAllocationTargetInput) => AllocationTarget` | Single |
| `getAllocationTarget` | `(targetKey: string, targetType?: string) => AllocationTarget \| undefined` | Single |
| `listAllocationTargets` | `(targetType?: string) => AllocationTarget[]` | Array |
| `setAllocationTargets` | `(targets: CreateAllocationTargetInput[]) => void` | - |
| `deleteAllocationTarget` | `(id: number) => void` | - |
| `validateAllocationTargets` | `(targetType?: string) => {valid, sum, errors}` | Object |

#### Liability Operations

| Method | Signature | Returns |
|--------|-----------|---------|
| `createLiability` | `(input: CreateLiabilityInput) => Liability` | Single |
| `getLiabilityById` | `(id: number) => Liability \| undefined` | Single |
| `listLiabilities` | `(activeOnly?: boolean) => Liability[]` | Array |
| `updateLiability` | `(id: number, updates: UpdateLiabilityInput) => void` | - |
| `getMortgageByLinkedAsset` | `(assetId: number) => Liability \| undefined` | Single |

#### Liability Balance Operations

| Method | Signature | Returns |
|--------|-----------|---------|
| `createLiabilityBalance` | `(input: CreateLiabilityBalanceInput) => LiabilityBalance` | Single |
| `getLiabilityBalancesBySnapshotId` | `(snapshotId: number) => LiabilityBalanceWithDetails[]` | Array |
| `updateLiabilityBalance` | `(id: number, updates: UpdateLiabilityBalanceInput) => void` | - |
| `deleteLiabilityBalance` | `(id: number) => void` | - |

#### Cache Operations

| Method | Signature | Returns |
|--------|-----------|---------|
| `saveSnapshotTotalsCache` | `(input: CreateSnapshotTotalsCacheInput) => SnapshotTotalsCache` | Single |
| `getSnapshotTotalsCache` | `(snapshotId: number) => SnapshotTotalsCache \| null` | Single |
| `getSnapshotTotalsCacheBulk` | `(snapshotIds: number[]) => Map<number, SnapshotTotalsCache>` | Map |
| `invalidateSnapshotCache` | `(snapshotId: number) => void` | - |
| `invalidateAllSnapshotCaches` | `() => number` | Count |

---

### RatesRepository

Market price data access.

**Constructor:**

```typescript
constructor(
  db: Database.Database,
  cacheTTLMinutes?: number = 5
)
```

#### Historical Rates

| Method | Signature | Returns |
|--------|-----------|---------|
| `saveHistoricalRate` | `(input: SaveRateInput) => HistoricalRate` | Single |
| `getHistoricalRate` | `(symbol: string, date: string, baseCurrency?: string) => HistoricalRate \| undefined` | Single |
| `getHistoricalRatesForAsset` | `(symbol: string, baseCurrency?: string, limit?: number) => HistoricalRate[]` | Array |
| `getHistoricalRatesRange` | `(symbol: string, startDate: string, endDate: string, baseCurrency?: string) => HistoricalRate[]` | Array |
| `getLatestHistoricalRate` | `(symbol: string, baseCurrency?: string) => HistoricalRate \| undefined` | Single |

#### Rate Cache

| Method | Signature | Returns |
|--------|-----------|---------|
| `getCachedRate` | `(symbol: string, baseCurrency?: string) => RateCache \| undefined` | Single (TTL checked) |
| `updateCachedRate` | `(symbol: string, price: number, baseCurrency?: string) => void` | - |
| `deleteCachedRate` | `(symbol: string, baseCurrency?: string) => void` | - |
| `clearCache` | `() => void` | - |

---

## Error Classes & Codes

All errors extend `ServiceError`:

```typescript
class ServiceError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}
```

### Error Reference

| Error Class | Code | Constructor | Description |
|-------------|------|-------------|-------------|
| **Snapshot Errors** |
| `SnapshotNotFoundError` | `SNAPSHOT_NOT_FOUND` | `(date: string)` | No snapshot for date |
| `SnapshotAlreadyExistsError` | `SNAPSHOT_ALREADY_EXISTS` | `(date: string, holdingsCount: number)` | Duplicate snapshot |
| **Asset Errors** |
| `AssetNotFoundError` | `ASSET_NOT_FOUND` | `(symbol: string)` | Unknown asset |
| `AssetDiscoveryError` | `ASSET_DISCOVERY_FAILED` | `(symbol: string, reason: string)` | API lookup failed |
| **Holding Errors** |
| `HoldingNotFoundError` | `HOLDING_NOT_FOUND` | `(symbol: string, snapshotDate: string)` | Holding not in snapshot |
| **Validation Errors** |
| `InvalidDateError` | `INVALID_DATE` | `(date: string)` | Bad date format |
| `InvalidAmountError` | `INVALID_AMOUNT` | `(amount: number)` | Non-positive amount |
| **Allocation Errors** |
| `AllocationTargetsSumError` | `ALLOCATION_TARGETS_SUM_INVALID` | `(sum: number)` | Sum != 100% |
| `DuplicateAllocationTargetError` | `DUPLICATE_ALLOCATION_TARGET` | `(targetKey: string)` | Duplicate key |
| `NoAllocationTargetsError` | `NO_ALLOCATION_TARGETS` | `()` | No targets set |
| **Portfolio Errors** |
| `NoPortfolioDataError` | `NO_PORTFOLIO_DATA` | `(date?: string)` | No holdings |
| **Price Errors** |
| `PriceFetchError` | `PRICE_FETCH_FAILED` | `(symbol: string, reason: string)` | API error |
| **Liability Errors** |
| `LiabilityNotFoundError` | `LIABILITY_NOT_FOUND` | `(id: number)` | Unknown liability |
| `LiabilityBalanceNotFoundError` | `LIABILITY_BALANCE_NOT_FOUND` | `(date: string, liabilityId: number)` | Balance not found |
| **Property Errors** |
| `PropertyNotFoundError` | `PROPERTY_NOT_FOUND` | `(id: number)` | Unknown property |
| `InvalidPropertyTypeError` | `INVALID_PROPERTY_TYPE` | `(propertyType: string)` | Bad property type |
| `InvalidPropertyValueError` | `INVALID_PROPERTY_VALUE` | `(value: number)` | Non-positive value |

### Error Handling Example

```typescript
try {
  const snapshot = snapshotService.getSnapshotByDate(date);
} catch (error) {
  if (error instanceof SnapshotNotFoundError) {
    console.log(`No snapshot for ${error.date}`);
  } else if (error instanceof ServiceError) {
    console.log(`Error [${error.code}]: ${error.message}`);
  }
}
```

---

**Last Updated:** January 2025
