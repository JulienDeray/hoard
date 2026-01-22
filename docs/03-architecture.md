# Architecture

System design and architectural patterns used in Hoard.

## Table of Contents

1. [System Overview](#system-overview)
2. [Design Principles](#design-principles)
3. [System Architecture Diagram](#system-architecture-diagram)
4. [Database Architecture](#database-architecture)
5. [Service Layer](#service-layer)
6. [Data Flow](#data-flow)
7. [Caching Strategy](#caching-strategy)
8. [Error Handling](#error-handling)
9. [Key Architectural Decisions](#key-architectural-decisions)

---

## System Overview

**Hoard** is a personal CFO platform for multi-asset wealth management. It's built as a TypeScript CLI application with:

- Local SQLite databases for data storage
- External APIs for market data (CoinMarketCap) and AI queries (Claude)
- Pure service layer with typed error handling
- Monthly snapshot-based portfolio tracking

### Core Capabilities

- **Unified Net Worth**: Track crypto, stocks, real estate, and liabilities
- **Allocation Management**: Set targets and track drift
- **Natural Language Queries**: Ask questions in plain English via Claude AI
- **Decision Support**: Rebalancing suggestions and portfolio analytics

---

## Design Principles

### 1. Offline-First

Financial data stays local. External APIs are only used for:
- Cryptocurrency prices (CoinMarketCap)
- Natural language processing (Claude)

No user data is sent to external services.

### 2. Code Over Formulas

Financial calculations are:
- Implemented in testable TypeScript code
- Version-controlled and auditable
- Composable and reusable

### 3. Progressive Disclosure

- Simple overview first (`portfolio summary`)
- Drill-down on demand (`snapshot view`, `allocation compare`)
- Natural language for complex questions

### 4. Correct by Construction

- Typed data models with validation
- Service errors are typed, not thrown generically
- Database constraints enforce data integrity

### 5. Monthly Cadence

Designed for monthly portfolio reviews, not real-time trading. This simplifies:
- Data storage (snapshots, not transactions)
- Price caching (5-minute TTL is acceptable)
- User workflows (review, don't react)

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Commands Layer                        │
│  (snapshot, query, portfolio, allocation, migrate, env)         │
│                                                                  │
│  • User interaction via @clack/prompts                          │
│  • Error handling with user-friendly messages                   │
│  • Database connection management                               │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer (Pure Functions)              │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ SnapshotService │  │ PortfolioService│  │ AllocationSvc   │ │
│  │                 │  │                 │  │                 │ │
│  │ • CRUD ops      │  │ • Value calcs   │  │ • Compare vs    │ │
│  │ • Holdings mgmt │  │ • Price enrich  │  │   targets       │ │
│  │ • Asset lookup  │  │ • Multi-asset   │  │ • Rebalancing   │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ PropertyService │  │ LiabilityService│  │ AllocationTarget│ │
│  │ (real estate)   │  │ (loans/mortg.)  │  │ Service         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ CoinMarketCap   │  │ ClaudeService   │  │ QueryProcessor  │ │
│  │ Service         │  │                 │  │                 │ │
│  │                 │  │ • NL processing │  │ • Tool executor │ │
│  │ • Rate limiting │  │ • Tool calling  │  │ • Result format │ │
│  │ • Price fetch   │  │ • Conversation  │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Repository Layer (Data Access)                   │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │     LedgerRepository     │  │      RatesRepository         │ │
│  │                          │  │                              │ │
│  │ • Snapshots              │  │ • Historical rates           │ │
│  │ • Holdings               │  │ • Rate cache (5-min TTL)     │ │
│  │ • Assets                 │  │                              │ │
│  │ • Liabilities            │  │                              │ │
│  │ • Allocation targets     │  │                              │ │
│  │ • Snapshot cache         │  │                              │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────┬──────────────────────┬──────────────────┐
│   ledger.db (User)   │   rates.db (Market)  │  External APIs   │
│                      │                      │                  │
│  • snapshots         │  • rate_cache        │  • CoinMarketCap │
│  • holdings          │  • historical_rates  │    (prices)      │
│  • assets            │                      │                  │
│  • liabilities       │  (5-minute TTL)      │  • Claude        │
│  • liability_balance │                      │    (NL queries)  │
│  • allocation_target │                      │                  │
│  • snapshot_cache    │                      │                  │
└──────────────────────┴──────────────────────┴──────────────────┘
```

---

## Database Architecture

### Two-Database Design

Hoard uses two separate SQLite databases:

| Database | Purpose | Path | Update Frequency |
|----------|---------|------|------------------|
| **Ledger** | User portfolio data | `data/{env}/ledger.db` | On user action |
| **Rates** | Market price data | `data/{env}/rates.db` | On price fetch |

### Why Two Databases?

1. **Separation of Concerns**
   - Ledger: User-controlled data, complex schema with FKs
   - Rates: API-sourced data, simple schema, can be rebuilt

2. **Independent Schema Evolution**
   - Ledger migrations are versioned and carefully managed
   - Rates schema is stable and simple

3. **Different Backup Strategies**
   - Ledger: Critical, backup before every migration
   - Rates: Can be regenerated from API if lost

### Ledger Database Schema

```
┌──────────────────┐       ┌──────────────────┐
│    snapshots     │       │      assets      │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ date (UNIQUE)    │       │ symbol (UNIQUE)  │
│ notes            │       │ name             │
│ created_at       │       │ asset_class      │
│ updated_at       │       │ valuation_source │
└────────┬─────────┘       │ external_id      │
         │                 │ currency         │
         │                 │ metadata (JSON)  │
         │                 │ is_active        │
         │                 └────────┬─────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐       ┌──────────────────┐
│     holdings     │       │   liabilities    │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ snapshot_id (FK) │◄──────│ linked_asset_id  │
│ asset_id (FK)    │───────│ name             │
│ amount           │       │ liability_type   │
│ notes            │       │ original_amount  │
└──────────────────┘       │ interest_rate    │
                           │ start_date       │
         │                 │ term_months      │
         │                 │ is_active        │
         │                 └────────┬─────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐       ┌────────────────────┐
│ snapshot_totals_ │       │ liability_balances │
│ cache            │       ├────────────────────┤
├──────────────────┤       │ id (PK)            │
│ id (PK)          │       │ snapshot_id (FK)   │
│ snapshot_id (FK) │       │ liability_id (FK)  │
│ total_assets_eur │       │ outstanding_amount │
│ total_liab_eur   │       └────────────────────┘
│ net_worth_eur    │
│ cached_at        │       ┌────────────────────┐
└──────────────────┘       │ allocation_targets │
                           ├────────────────────┤
                           │ id (PK)            │
                           │ target_type        │
                           │ target_key         │
                           │ target_percentage  │
                           │ tolerance_pct      │
                           │ notes              │
                           └────────────────────┘
```

### Rates Database Schema

```
┌──────────────────────┐       ┌──────────────────────┐
│   historical_rates   │       │      rate_cache      │
├──────────────────────┤       ├──────────────────────┤
│ id (PK)              │       │ asset_symbol (PK)    │
│ asset_symbol         │       │ base_currency        │
│ base_currency        │       │ price                │
│ price                │       │ last_updated         │
│ timestamp            │       └──────────────────────┘
│ volume_24h           │
│ market_cap           │       TTL: 5 minutes
│ source               │       (checked on read)
└──────────────────────┘
```

### Database Connection Management

The `DatabaseManager` singleton manages connections:

```typescript
// Get connections (creates if needed)
const ledgerDb = DatabaseManager.getLedgerDb(path);
const ratesDb = DatabaseManager.getRatesDb(path);

// Path-aware: changing path auto-closes old connection
DatabaseManager.getLedgerDb('/path/a');
DatabaseManager.getLedgerDb('/path/b');  // Closes /path/a

// Cleanup (call in finally blocks)
DatabaseManager.closeAll();
```

**Features:**
- Foreign keys enabled: `PRAGMA foreign_keys = ON`
- Schema version validation on connect
- Automatic backup before migrations

---

## Service Layer

### Pure Service Pattern

Services are pure functions that:
- Accept dependencies via constructor (DI)
- Accept plain data as parameters
- Return plain data or typed errors
- Have no side effects beyond database writes

```typescript
export class SnapshotService {
  constructor(
    private ledgerRepo: LedgerRepository,
    private ratesRepo: RatesRepository,
    private cmcService: CoinMarketCapService,
    private baseCurrency: string = 'EUR'
  ) {}

  // Returns typed result, doesn't throw
  checkSnapshotExists(date: string): SnapshotExistsResult {
    // Validates date format
    // Returns { exists: boolean, snapshot?, holdings[] }
  }

  // Throws typed error on failure
  getSnapshotByDate(date: string): SnapshotWithHoldings {
    if (!isValidDate(date)) {
      throw new InvalidDateError(date);
    }
    // ...
  }
}
```

### Service Composition

Services are composed hierarchically:

```
CLI Command
    │
    ├── SnapshotService
    │       ├── LedgerRepository
    │       ├── RatesRepository
    │       └── CoinMarketCapService
    │
    ├── PortfolioService
    │       ├── LedgerRepository
    │       ├── RatesRepository
    │       └── CoinMarketCapService
    │
    └── AllocationService
            ├── LedgerRepository
            └── PortfolioService
```

### Service Responsibilities

| Service | Responsibility |
|---------|----------------|
| **SnapshotService** | Snapshot CRUD, holdings management, asset lookup |
| **PortfolioService** | Value calculations, price enrichment |
| **AllocationService** | Compare vs targets, rebalancing suggestions |
| **AllocationTargetService** | Target CRUD, validation |
| **PropertyService** | Real estate properties, equity calculations |
| **LiabilityService** | Loans/mortgages, balance tracking |
| **CoinMarketCapService** | Price API client, rate limiting |
| **ClaudeService** | Natural language processing, tool calling |
| **QueryProcessor** | Claude tool execution, result formatting |

---

## Data Flow

### Example: Add Portfolio Snapshot

```
User: npm run dev snapshot add
    │
    ▼
┌─────────────────────────────────────┐
│ CLI: snapshot.ts                    │
│ • Prompt for date, holdings         │
│ • Initialize services               │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ SnapshotService.getOrCreateSnapshot │
│ • Validate date format              │
│ • Check if exists                   │
│ • Create if needed                  │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ For each holding:                   │
│ SnapshotService.addHolding          │
│ • Lookup/create asset               │
│ • Create holding record             │
│ • Invalidate snapshot cache         │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ LedgerRepository                    │
│ • INSERT INTO holdings              │
│ • DELETE FROM snapshot_totals_cache │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ DatabaseManager.closeAll()          │
│ CLI: Display success message        │
└─────────────────────────────────────┘
```

### Example: Natural Language Query

```
User: "What's my portfolio worth?"
    │
    ▼
┌─────────────────────────────────────┐
│ CLI: query.ts                       │
│ • Initialize QueryProcessor         │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ QueryProcessor.processQuery()       │
│ • Pass to ClaudeService             │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ ClaudeService                       │
│ • Send to Claude API with tools     │
│ • Claude decides: use                │
│   calculate_portfolio_value tool    │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ QueryProcessor executes tool        │
│ • PortfolioService.getPortfolioValue│
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ PortfolioService                    │
│ • Get holdings from ledger          │
│ • Get prices (cache → API)          │
│ • Calculate totals                  │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ Result → Claude                     │
│ • Claude generates text response    │
│ • Response displayed to user        │
└─────────────────────────────────────┘
```

---

## Caching Strategy

### Three-Tier Price Caching

```
Request for price
    │
    ▼
┌─────────────────────────────────┐
│ 1. Check rate_cache             │
│    (5-minute TTL)               │
│                                 │
│    Hit? → Return cached price   │
└────────────────┬────────────────┘
                 │ Miss
                 ▼
┌─────────────────────────────────┐
│ 2. Check historical_rates       │
│    (most recent)                │
│                                 │
│    Found? → Return as fallback  │
└────────────────┬────────────────┘
                 │ Not found
                 ▼
┌─────────────────────────────────┐
│ 3. Fetch from CoinMarketCap     │
│    (rate-limited, queued)       │
│                                 │
│    • Update rate_cache          │
│    • Save to historical_rates   │
│    • Return price               │
└─────────────────────────────────┘
```

### Snapshot Totals Cache

Pre-calculated totals for fast list queries:

```
snapshot_totals_cache
├── snapshot_id
├── total_assets_eur
├── total_liabilities_eur
├── net_worth_eur
└── cached_at
```

**Invalidation:**
- On holdings change: Delete cache for that snapshot
- On liability_balances change: Delete cache for that snapshot
- On calculation logic change: Delete all caches (migration step)

---

## Error Handling

### Typed Error Classes

All service errors extend `ServiceError`:

```typescript
class ServiceError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

class SnapshotNotFoundError extends ServiceError {
  constructor(public readonly date: string) {
    super(`No snapshot found for ${date}`, 'SNAPSHOT_NOT_FOUND');
  }
}
```

### Error Codes

| Code | Error Class | Meaning |
|------|-------------|---------|
| `SNAPSHOT_NOT_FOUND` | SnapshotNotFoundError | No snapshot for date |
| `SNAPSHOT_ALREADY_EXISTS` | SnapshotAlreadyExistsError | Duplicate snapshot |
| `ASSET_NOT_FOUND` | AssetNotFoundError | Unknown asset symbol |
| `HOLDING_NOT_FOUND` | HoldingNotFoundError | Asset not in snapshot |
| `INVALID_DATE` | InvalidDateError | Bad date format |
| `INVALID_AMOUNT` | InvalidAmountError | Non-positive amount |
| `ALLOCATION_TARGETS_SUM_INVALID` | AllocationTargetsSumError | Targets don't sum to 100% |
| `PRICE_FETCH_FAILED` | PriceFetchError | API error |

### CLI Error Handling

```typescript
try {
  const result = snapshotService.getSnapshotByDate(date);
  // Success path
} catch (error) {
  if (error instanceof SnapshotNotFoundError) {
    Logger.error(`No snapshot found for ${error.date}`);
  } else if (error instanceof ServiceError) {
    Logger.error(error.message);
  } else {
    Logger.error('Unexpected error');
  }
  process.exit(1);
} finally {
  DatabaseManager.closeAll();
}
```

---

## Key Architectural Decisions

### Why SQLite?

- **Simplicity**: No server to manage, single file per database
- **Performance**: Fast for read-heavy workloads
- **Portability**: Easy backup (just copy the file)
- **Offline-first**: Works without network

### Why Two Databases?

- **Separation**: User data vs market data have different lifecycles
- **Independence**: Rates can be rebuilt; ledger cannot
- **Schema evolution**: Different migration needs

### Why Typed Errors?

- **Predictable handling**: Know exactly what can fail
- **Better DX**: IDE autocomplete for error properties
- **No generic catches**: Force explicit error handling

### Why Pure Services?

- **Testability**: Easy to mock dependencies
- **Composability**: Services can use other services
- **Clear data flow**: No hidden state or side effects

### Why Monthly Snapshots?

- **Simplicity**: No transaction log, just point-in-time captures
- **Storage efficiency**: One row per asset per month
- **User workflow**: Matches monthly review cadence
- **Price caching**: Acceptable to use 5-minute old prices

### Why Claude for NL Queries?

- **Tool calling**: Structured access to data
- **Conversation**: Follow-up questions work naturally
- **Intelligence**: Complex queries answered correctly
- **No training**: Works out of the box

---

**Last Updated:** January 2025
