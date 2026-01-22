# Domain Model

Entity reference, relationships, and schema versioning for Hoard.

## Table of Contents

1. [Entity Reference](#entity-reference)
2. [Entity Relationships](#entity-relationships)
3. [Asset Classes & Valuation Sources](#asset-classes--valuation-sources)
4. [Schema Versioning](#schema-versioning)
5. [Property Metadata](#property-metadata)
6. [Type Definitions](#type-definitions)

---

## Entity Reference

### Asset

Anything with positive value you own.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment identifier |
| `symbol` | TEXT | UNIQUE, NOT NULL | Trading symbol (BTC, ETH, AAPL, PROPERTY_001) |
| `name` | TEXT | NOT NULL | Human-readable name |
| `asset_class` | TEXT | NOT NULL | CRYPTO, FIAT, STOCK, REAL_ESTATE, COMMODITY, OTHER |
| `valuation_source` | TEXT | NOT NULL | CMC, YAHOO_FINANCE, MANUAL |
| `external_id` | TEXT | | External API identifier |
| `currency` | TEXT | DEFAULT 'EUR' | Base currency |
| `metadata` | TEXT | | JSON metadata (PropertyMetadata for real estate) |
| `is_active` | INTEGER | DEFAULT 1 | Soft delete flag (1=active, 0=inactive) |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Example:**

```sql
INSERT INTO assets (symbol, name, asset_class, valuation_source, external_id)
VALUES ('BTC', 'Bitcoin', 'CRYPTO', 'CMC', '1');
```

---

### Snapshot

Point-in-time capture of your entire financial state.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment identifier |
| `date` | TEXT | UNIQUE, NOT NULL | ISO 8601 date (YYYY-MM-DD) |
| `notes` | TEXT | | User notes for this snapshot |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Note:** Totals (assets, liabilities, net worth) are calculated dynamically from holdings + rates DB.

**Example:**

```sql
INSERT INTO snapshots (date, notes)
VALUES ('2025-01-22', 'Monthly portfolio review');
```

---

### Holding

Your position in an asset at a specific snapshot.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment identifier |
| `snapshot_id` | INTEGER | FK → snapshots.id, CASCADE | Parent snapshot |
| `asset_id` | INTEGER | FK → assets.id | Asset reference |
| `amount` | REAL | NOT NULL, CHECK >= 0 | Quantity held |
| `notes` | TEXT | | Holding-specific notes |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Unique Constraint:** `(snapshot_id, asset_id)` — one holding per asset per snapshot.

**Note:** Values are calculated dynamically from rates DB (single source of truth).

**Example:**

```sql
INSERT INTO holdings (snapshot_id, asset_id, amount)
VALUES (1, 1, 0.5);  -- 0.5 BTC in snapshot 1
```

---

### Liability

Anything you owe.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment identifier |
| `name` | TEXT | NOT NULL | Human-readable name |
| `liability_type` | TEXT | NOT NULL | LOAN, MORTGAGE, CREDIT_LINE |
| `linked_asset_id` | INTEGER | FK → assets.id | Optional link to property |
| `original_amount` | REAL | NOT NULL, CHECK > 0 | Principal at origination |
| `currency` | TEXT | DEFAULT 'EUR' | Liability currency |
| `interest_rate` | REAL | | Annual interest rate (%) |
| `start_date` | TEXT | | Origination date (YYYY-MM-DD) |
| `term_months` | INTEGER | | Loan term in months |
| `is_active` | INTEGER | DEFAULT 1 | Soft delete flag |
| `notes` | TEXT | | Liability notes |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Example:**

```sql
INSERT INTO liabilities (name, liability_type, linked_asset_id, original_amount, interest_rate, term_months)
VALUES ('House Mortgage', 'MORTGAGE', 5, 400000, 2.5, 360);
```

---

### LiabilityBalance

Outstanding balance on a liability at a specific snapshot.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment identifier |
| `snapshot_id` | INTEGER | FK → snapshots.id, CASCADE | Parent snapshot |
| `liability_id` | INTEGER | FK → liabilities.id, CASCADE | Liability reference |
| `outstanding_amount` | REAL | NOT NULL, CHECK >= 0 | Amount owed at snapshot date |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Unique Constraint:** `(snapshot_id, liability_id)` — one balance per liability per snapshot.

**Note:** All liabilities are in EUR, so outstanding_amount is the EUR value.

**Example:**

```sql
INSERT INTO liability_balances (snapshot_id, liability_id, outstanding_amount)
VALUES (1, 1, 285000);  -- €285,000 outstanding on mortgage
```

---

### AllocationTarget

Desired portfolio allocation.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment identifier |
| `target_type` | TEXT | NOT NULL | ASSET or ASSET_CLASS |
| `target_key` | TEXT | NOT NULL | Symbol (ASSET) or class name (ASSET_CLASS) |
| `target_percentage` | REAL | NOT NULL, CHECK 0-100 | Desired allocation % |
| `tolerance_pct` | REAL | DEFAULT 2.0 | Acceptable drift % |
| `notes` | TEXT | | Target notes |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Unique Constraint:** `(target_type, target_key)` — no duplicate targets.

**Example:**

```sql
-- Target 50% Bitcoin
INSERT INTO allocation_targets (target_type, target_key, target_percentage, tolerance_pct)
VALUES ('ASSET', 'BTC', 50.0, 2.0);

-- Target 60% in crypto asset class
INSERT INTO allocation_targets (target_type, target_key, target_percentage, tolerance_pct)
VALUES ('ASSET_CLASS', 'CRYPTO', 60.0, 5.0);
```

---

### HistoricalRate (Rates DB)

Historical prices with timestamp.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment identifier |
| `asset_symbol` | TEXT | NOT NULL | Links to assets.symbol |
| `base_currency` | TEXT | DEFAULT 'EUR' | Target currency |
| `price` | REAL | NOT NULL | Price in base currency |
| `timestamp` | TEXT | NOT NULL | ISO 8601 timestamp |
| `volume_24h` | REAL | | 24-hour trading volume |
| `market_cap` | REAL | | Market capitalization |
| `source` | TEXT | DEFAULT 'coinmarketcap' | Data source |

**Unique Constraint:** `(asset_symbol, base_currency, timestamp)`

---

### RateCache (Rates DB)

Current prices with 5-minute TTL.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `asset_symbol` | TEXT | PRIMARY KEY | Links to assets.symbol |
| `base_currency` | TEXT | DEFAULT 'EUR' | Target currency |
| `price` | REAL | NOT NULL | Current price |
| `last_updated` | TEXT | NOT NULL | Cache timestamp |

**Note:** TTL enforced by application logic, not database.

---

### SnapshotTotalsCache

Pre-calculated snapshot totals for fast list queries.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment identifier |
| `snapshot_id` | INTEGER | UNIQUE, FK → snapshots.id, CASCADE | Parent snapshot |
| `total_assets_eur` | REAL | DEFAULT 0 | Sum of holding values |
| `total_liabilities_eur` | REAL | DEFAULT 0 | Sum of outstanding amounts |
| `net_worth_eur` | REAL | DEFAULT 0 | Assets - liabilities |
| `cached_at` | TEXT | NOT NULL | Cache timestamp |

**Invalidation:** Deleted when holdings or liability_balances change.

---

## Entity Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│                         LEDGER DATABASE                          │
└──────────────────────────────────────────────────────────────────┘

  snapshots                                    assets
  ┌────────────┐                              ┌────────────┐
  │ id (PK)    │                              │ id (PK)    │
  │ date       │                              │ symbol     │
  │ notes      │                              │ name       │
  └─────┬──────┘                              │ asset_class│
        │                                     │ metadata   │
        │ 1:N                                 └─────┬──────┘
        │                                           │
        ▼                                           │
  ┌────────────┐                                    │
  │  holdings  │         N:1                        │
  │ ──────────-│───────────────────────────────────►│
  │ snapshot_id│                                    │
  │ asset_id   │                                    │
  │ amount     │                                    │
  └─────┬──────┘                                    │
        │                                           │
        │ 1:N                                       │
        ▼                                           │
  ┌────────────────────┐                           │
  │ liability_balances │      liabilities          │
  │ ─────────────────  │     ┌────────────┐        │
  │ snapshot_id        │ N:1 │ id (PK)    │        │
  │ liability_id       │────►│ name       │        │
  │ outstanding_amount │     │ liability_ │   N:1  │
  └────────────────────┘     │   type     │◄───────┘
                             │ linked_    │  (optional,
                             │   asset_id │   for mortgages)
                             └────────────┘

  ┌────────────────────┐
  │ allocation_targets │     (standalone, compared against snapshots)
  │ ─────────────────  │
  │ target_type        │
  │ target_key         │
  │ target_percentage  │
  └────────────────────┘

  ┌────────────────────────┐
  │ snapshot_totals_cache  │  (1:1 with snapshots, invalidated on change)
  │ ─────────────────────  │
  │ snapshot_id            │
  │ total_assets_eur       │
  │ net_worth_eur          │
  └────────────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│                         RATES DATABASE                           │
└──────────────────────────────────────────────────────────────────┘

  historical_rates                 rate_cache
  ┌────────────────┐              ┌────────────────┐
  │ asset_symbol   │              │ asset_symbol   │
  │ timestamp      │              │ price          │
  │ price          │              │ last_updated   │
  │ volume_24h     │              │ (5-min TTL)    │
  └────────────────┘              └────────────────┘
        │                                │
        │   Links by symbol (no FK)      │
        └──────────┬─────────────────────┘
                   ▼
             assets.symbol
```

### Foreign Key Cascade Behavior

| Relationship | On Delete |
|--------------|-----------|
| `holdings.snapshot_id → snapshots.id` | CASCADE |
| `liability_balances.snapshot_id → snapshots.id` | CASCADE |
| `liability_balances.liability_id → liabilities.id` | CASCADE |
| `snapshot_totals_cache.snapshot_id → snapshots.id` | CASCADE |
| `liabilities.linked_asset_id → assets.id` | SET NULL |

---

## Asset Classes & Valuation Sources

### Asset Classes

| Class | Purpose | Examples | Default Valuation |
|-------|---------|----------|-------------------|
| `CRYPTO` | Cryptocurrencies | BTC, ETH, SOL | CMC |
| `FIAT` | Currencies & cash | EUR, USD, GBP | MANUAL (1:1) |
| `STOCK` | Equities & funds | AAPL, VTI, VTSAX | YAHOO_FINANCE |
| `REAL_ESTATE` | Properties & land | PRIMARY_HOME, RENTAL_001 | MANUAL |
| `COMMODITY` | Metals, oil, etc. | GOLD, SILVER | CMC or MANUAL |
| `OTHER` | Uncategorized | WINE_COLLECTION, ARTWORK | MANUAL |

### Valuation Sources

| Source | API | Description | Cache TTL |
|--------|-----|-------------|-----------|
| `CMC` | CoinMarketCap | Real-time crypto prices | 5 min |
| `YAHOO_FINANCE` | Yahoo Finance | Stock prices | 5 min |
| `MANUAL` | None | User-entered values | N/A |

### Valuation Workflow

1. **Crypto with CMC:**
   - `external_id` = CoinMarketCap ID
   - Price fetched from CMC API
   - Cached for 5 minutes

2. **Stocks with Yahoo:**
   - `external_id` = Yahoo ticker
   - (Manual maintenance in current version)

3. **Real Estate:**
   - `valuation_source` = MANUAL
   - `metadata` = PropertyMetadata JSON
   - User updates value via snapshot entry

---

## Schema Versioning

### Current Version: 7

### Migration History

| Version | Description | Key Changes |
|---------|-------------|-------------|
| 1 | Initial schema | snapshots, holdings, assets tables |
| 2 | Allocation targets | allocation_targets table |
| 3 | Multi-asset schema | Assets: symbol→id PK, liabilities, liability_balances |
| 4 | Remove value_eur | Holdings: removed redundant value_eur column |
| 5 | Remove snapshot totals | Snapshots: removed total columns (calculated dynamically) |
| 6 | Snapshot totals cache | Added snapshot_totals_cache table |
| 7 | Asset metadata | Added assets.metadata column for PropertyMetadata |

### Migration Files

```
src/database/migrations/
├── ledger/
│   ├── 001_initial.sql
│   ├── 002_allocation_targets.sql
│   ├── 003_schema_v2.sql
│   ├── 004_remove_value_eur.sql
│   ├── 005_remove_snapshot_totals.sql
│   ├── 006_snapshot_totals_cache.sql
│   └── 007_add_asset_metadata.sql
└── rates/
    └── 001_initial.sql
```

### Version Tracking

Applied migrations are tracked in `schema_version`:

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## Property Metadata

Real estate assets store additional details in the `metadata` JSON column.

### PropertyMetadata Structure

```typescript
interface PropertyMetadata {
  propertyType: 'PRIMARY_RESIDENCE' | 'RENTAL' | 'VACATION' | 'COMMERCIAL' | 'LAND' | 'OTHER';
  address?: string;
  city?: string;
  country?: string;
  purchaseDate?: string;      // ISO 8601
  purchasePrice?: number;     // EUR
  squareMeters?: number;
  rooms?: number;
  rentalIncome?: number;      // Monthly income for RENTAL type
}
```

### Example Property Asset

```sql
INSERT INTO assets (symbol, name, asset_class, valuation_source, metadata)
VALUES (
  'PROPERTY_MAIN',
  'Main House',
  'REAL_ESTATE',
  'MANUAL',
  '{"propertyType":"PRIMARY_RESIDENCE","address":"123 Main St","city":"Berlin","country":"Germany","purchaseDate":"2020-06-15","purchasePrice":500000,"squareMeters":150,"rooms":4}'
);
```

### Property-Mortgage Linking

Mortgages can be linked to properties via `liabilities.linked_asset_id`:

```sql
-- Property asset (id = 5)
INSERT INTO assets (symbol, name, asset_class, valuation_source)
VALUES ('PROPERTY_MAIN', 'Main House', 'REAL_ESTATE', 'MANUAL');

-- Linked mortgage
INSERT INTO liabilities (name, liability_type, linked_asset_id, original_amount)
VALUES ('House Mortgage', 'MORTGAGE', 5, 400000);
```

This enables equity calculation:

```
Property Equity = Property Value - Mortgage Outstanding Balance
```

---

## Type Definitions

TypeScript types are in `src/models/`:

### Core Types

```typescript
// Asset
interface Asset {
  id: number;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  valuation_source: ValuationSource;
  external_id?: string;
  currency: string;
  metadata?: string;  // JSON
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Snapshot
interface Snapshot {
  id: number;
  date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Holding
interface Holding {
  id: number;
  snapshot_id: number;
  asset_id: number;
  amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Liability
interface Liability {
  id: number;
  name: string;
  liability_type: LiabilityType;
  linked_asset_id?: number;
  original_amount: number;
  currency: string;
  interest_rate?: number;
  start_date?: string;
  term_months?: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

### Enriched Types

```typescript
// Holding with asset details (from JOIN)
interface HoldingWithAsset extends Holding {
  asset_symbol: string;
  asset_name: string;
  asset_class: string;
}

// Holding with calculated value
interface HoldingWithValue extends HoldingWithAsset {
  current_price_eur?: number;
  current_value_eur?: number;
  current_percentage?: number;
}

// Snapshot with holdings
interface SnapshotWithHoldings {
  snapshot: Snapshot;
  holdings: HoldingWithAsset[];
}

// Liability balance with details
interface LiabilityBalanceWithDetails {
  id: number;
  snapshot_id: number;
  liability_id: number;
  outstanding_amount: number;
  liability_name: string;
  liability_type: string;
  linked_asset_id?: number;
}
```

### Enums

```typescript
type AssetClass = 'CRYPTO' | 'FIAT' | 'STOCK' | 'REAL_ESTATE' | 'COMMODITY' | 'OTHER';

type ValuationSource = 'CMC' | 'YAHOO_FINANCE' | 'MANUAL';

type LiabilityType = 'LOAN' | 'MORTGAGE' | 'CREDIT_LINE';

type AllocationTargetType = 'ASSET' | 'ASSET_CLASS';

type PropertyType = 'PRIMARY_RESIDENCE' | 'RENTAL' | 'VACATION' | 'COMMERCIAL' | 'LAND' | 'OTHER';
```

---

**Last Updated:** January 2025
