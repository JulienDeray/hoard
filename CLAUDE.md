# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hoard** is a personal CFO platform — not just tracking, but decision support. It's a TypeScript-based web application for multi-asset wealth management with natural language queries powered by Claude AI.

### Vision

> Reduce monthly financial review from a 2-hour spreadsheet wrestling session to a 20-minute guided review that surfaces insights and next actions.

### What This Is

- Unified net worth visibility across all asset classes
- Actionable signals — allocation drift, rebalancing suggestions
- Analytical tools — financial frameworks implemented correctly
- Scenario modeling — "what if" simulations for major decisions

### What This Is Not

- Not a budgeting app (no transaction categorization)
- Not a trading platform (no execution)
- Not multi-tenant SaaS (personal tool)
- Not real-time (monthly cadence is the design point)

### Design Principles

1. **Code over formulas** — Testable, version-controlled, composable
2. **Correct by construction** — Financial calculations should be verifiable
3. **Progressive disclosure** — Simple overview first, drill-down on demand
4. **Fun, not tedious** — Pixel art aesthetic planned (v5)
5. **Offline-first** — Financial data stays local; APIs are for market data only

## Tech Stack

- **Language:** TypeScript (ESM modules)
- **Database:** SQLite with better-sqlite3
- **API:** Fastify REST API
- **Web UI:** React 19 + Vite 7 (in `/web/`)
- **APIs:**
  - Anthropic Claude API (natural language processing)
  - CoinMarketCap API (crypto price data)
- **Key Dependencies:** axios, zod, date-fns

## Project Structure

```
src/
├── api/
│   ├── index.ts                    # API entry point
│   ├── server.ts                   # Fastify server setup
│   └── routes/                     # API route handlers
├── database/
│   ├── connection.ts               # DatabaseManager singleton
│   ├── ledger.ts                   # LedgerRepository (snapshots, holdings, assets, liabilities, targets)
│   ├── rates.ts                    # RatesRepository (price data)
│   └── migrations/
│       ├── runner.ts               # Migration runner with versioning
│       ├── backfill.ts             # Data backfill functions
│       ├── ledger/                 # Ledger schema migrations
│       │   ├── 001_initial.sql
│       │   ├── 002_allocation_targets.sql
│       │   ├── 003_schema_v2.sql   # Multi-asset schema
│       │   └── ...
│       └── rates/001_initial.sql   # Rates schema
├── services/
│   ├── snapshot.ts                 # Pure service for snapshot operations
│   ├── allocation-target.ts        # Pure service for allocation targets
│   ├── allocation.ts               # Allocation calculations & comparisons
│   ├── portfolio.ts                # Portfolio value calculations
│   ├── coinmarketcap.ts            # CoinMarketCap API client (rate-limited)
│   ├── claude.ts                   # Claude API with tool definitions
│   └── query-processor.ts          # Tool executor for Claude
├── errors/
│   └── index.ts                    # TypeScript service error classes
├── models/
│   ├── snapshot.ts, holding.ts, asset.ts, rate.ts, allocation.ts
│   ├── liability.ts                # Liability and balance models
│   └── index.ts                    # Barrel export
└── utils/
    ├── config.ts                   # Config management with Conf
    ├── formatters.ts               # European number/Euro formatting
    └── validators.ts               # Zod validators

web/                                # React + Vite frontend
scripts/
└── migrate.ts                      # Database migration script

data/                               # Runtime SQLite databases (gitignored)
├── dev/                            # Development databases
└── prod/                           # Production databases

.claude/skills/                     # Custom Claude Code skills
├── testing-workflow/               # Test creation and maintenance
└── validate/                       # Build, lint, test validation

docs/
├── 01-getting-started.md           # Installation, setup, quick start
├── 02-user-guide.md                # API and web UI reference
├── 03-architecture.md              # System design, data flows
├── 04-domain-model.md              # Entities, relationships, schema
├── 05-developer-guide.md           # Adding features, conventions
├── 06-api-reference.md             # Service interfaces, errors
└── 07-operations.md                # Migrations, backups, troubleshooting
```

## Domain Model (Schema v7)

### Core Entities

**Asset** — Anything with positive value you own
- Fields: id, symbol (unique), name, asset_class, valuation_source, external_id, currency, is_active
- Asset classes: `CRYPTO`, `FIAT`, `STOCK`, `REAL_ESTATE`, `COMMODITY`, `OTHER`
- Valuation sources: `CMC`, `YAHOO_FINANCE`, `MANUAL`

**Liability** — Anything you owe
- Fields: id, name, liability_type, original_amount, interest_rate, start_date, term_months, is_active
- Liability types: `LOAN`, `MORTGAGE`, `CREDIT_LINE`

**Snapshot** — Point-in-time capture of entire financial state
- Fields: id, date, notes
- Note: Totals (assets, liabilities, net worth) are calculated dynamically from holdings + rates DB

**Holding** — Your position in an asset at a specific snapshot
- Fields: id, snapshot_id (FK), asset_id (FK), amount, notes
- Note: Asset values are calculated dynamically from the rates DB (single source of truth)

**LiabilityBalance** — Outstanding balance on a liability at a specific snapshot
- Fields: snapshot_id (FK), liability_id (FK), outstanding_amount
- Note: All liabilities are in EUR, so outstanding_amount is the EUR value

**AllocationTarget** — Desired portfolio allocation
- Fields: id, target_type (`ASSET` or `ASSET_CLASS`), target_key, target_percentage, tolerance_pct, notes

### Entity Relationships

```
Snapshot (monthly)
    ├── Holding[] ─────→ Asset
    │                      ├── asset_class
    │                      └── valuation_source
    └── LiabilityBalance[] ─→ Liability

AllocationTarget[]
    └── compared against Snapshot holdings
```

## Database Architecture

### Two SQLite Databases

1. **Ledger DB** (`data/{env}/ledger.db`) - User data
   - `snapshots` - Portfolio snapshots with totals
   - `holdings` - Asset amounts per snapshot
   - `assets` - Multi-type asset metadata
   - `allocation_targets` - Portfolio allocation targets
   - `liabilities` - Loans/mortgages
   - `liability_balances` - Liability amounts per snapshot
   - `schema_version` - Tracks applied migrations

2. **Rates DB** (`data/{env}/rates.db`) - Market data
   - `historical_rates` - Historical prices with timestamp
   - `rate_cache` - Current prices (5-minute TTL)

### Database Access Pattern

- `DatabaseManager.getLedgerDb(path)` - Returns singleton ledger DB instance
- `DatabaseManager.getRatesDb(path)` - Returns singleton rates DB instance
- Repositories (`LedgerRepository`, `RatesRepository`) wrap DB operations
- Migrations must be run explicitly via `npm run migrate`

## Common Commands

```bash
# Development
npm run build                       # Compile TypeScript to dist/
npm run dev:api                     # Run API server (defaults to dev)
npm run dev:api:dev                 # Run API server in dev mode
npm run dev:api:prod                # Run API server in prod mode
npm run dev:web                     # Run web UI dev server
npm run dev:all                     # Run both API and web UI

# Database migrations
npm run migrate                     # Run pending migrations (dev)
npm run migrate -- --env=prod       # Run migrations on production
npm run migrate -- --dry-run        # Preview migrations without applying
npm run migrate -- --status         # Show current schema version
npm run migrate -- --backfill       # Run data backfill operations

# Testing and quality
npm test                            # Run Vitest tests
npm test -- --watch                 # Watch mode
npm test -- --coverage              # With coverage
npm run lint                        # ESLint
npm run format                      # Prettier

# Web UI
npm run web:dev                     # Start web dev server
npm run web:build                   # Build web for production
```

## Service Layer Architecture

### Pure Services (Decoupled from API)

Services return typed errors instead of throwing, making them composable and testable.

**SnapshotService** - Snapshot operations
- `checkSnapshotExists(date)` → `SnapshotAlreadyExistsError | null`
- `addSnapshot(date, notes, holdings)` → Creates snapshot with holdings
- `listSnapshots()` → Returns all snapshots
- `deleteSnapshot(date, assetSymbol?)` → Deletes snapshot or specific holding

**AllocationTargetService** - Allocation target management
- `setTargets(targets)` → Sets/updates allocation targets
- `listTargets()` → Returns all targets
- `validateTargetsSum()` → Ensures targets sum to 100%
- `clearTargets()` → Removes all targets

### Core Services

**PortfolioService** - Portfolio value calculations
- Enriches holdings with prices (cached or from API)
- Calculates portfolio values for any date
- Coordinates between ledger, rates, and CoinMarketCap

**AllocationService** - Allocation comparisons
- Compares current allocation vs targets
- Calculates drift indicators
- Suggests rebalancing actions

**CoinMarketCapService** - External API client
- Request queue with 1-second delay between calls
- Methods: `getCurrentPrice()`, `getHistoricalPrice()`, `backfillHistoricalRates()`
- Handles rate limiting for free tier (~333 calls/day)

**ClaudeService** - AI query processing
- Tool calling with 4 tools: get_holdings, calculate_portfolio_value, get_historical_price, list_snapshots
- System prompt defines assistant role and capabilities
- Handles tool use loop until final text response

**QueryProcessor** - Tool execution coordinator
- Executes tools requested by Claude
- Formats database results for Claude
- Bridges AI service with data layer

## Error Handling System

### Service Errors (`src/errors/index.ts`)

Typed error classes with error codes for consistent handling:

```typescript
// Base class
ServiceError { code: string, message: string }

// Snapshot errors
SnapshotNotFoundError
SnapshotAlreadyExistsError

// Asset errors
AssetNotFoundError
AssetDiscoveryError

// Holding errors
HoldingNotFoundError

// Validation errors
InvalidDateError
InvalidAmountError

// Allocation errors
AllocationTargetsSumError
DuplicateAllocationTargetError
NoAllocationTargetsError

// Portfolio errors
NoPortfolioDataError

// Price errors
PriceFetchError
```

## Claude Code Skills

### `/validate` - Code Quality Validation

Runs build, lint, and tests in sequence. Stops on first failure.

```bash
# Invoked via skill
/validate
```

Checks (in order):
1. TypeScript build (`npm run build`)
2. ESLint (`npm run lint`)
3. Tests (`npm test`)

### `/testing-workflow` - Test Management

Manages testing lifecycle for code changes:
1. Analyzes changes to identify test needs
2. Creates/updates tests using templates
3. Runs tests and analyzes failures
4. Updates acceptance criteria docs

**Template mapping:**
| File Pattern | Test Focus |
|-------------|------------|
| `src/services/*.ts` | Business logic, service coordination |
| `src/database/*.ts` | Database operations with in-memory DB |
| `src/api/routes/*.ts` | API endpoint testing |
| `src/utils/*.ts` | Utility functions |

## Testing Strategy

Uses Vitest with a testing pyramid approach:
- **Unit tests**: Services, repositories, utilities (majority)
- **Integration tests**: Database operations, service coordination
- **API tests**: Route handlers, request/response validation

**Test locations:**
- Service tests: `tests/services/`
- Repository tests: `tests/database/`
- API tests: `tests/api/`
- Test helpers: `tests/helpers/`

**Mocking:**
- External APIs (CoinMarketCap, Claude) are always mocked
- Database tests use in-memory SQLite (`:memory:`)

## Important Implementation Details

### Node Version
- **Required:** Node v22.19.0
- Always use this specific version; do not use other Node versions

### ESM Modules
- `package.json` has `"type": "module"`
- Use `.js` extensions in import paths (TypeScript ESM requirement)
- Use `import.meta.url` and `fileURLToPath` for `__dirname` equivalents

### Database Migrations

The project uses a versioned migration system managed by `MigrationRunner`:

- SQL files in `src/database/migrations/ledger/` numbered sequentially (001, 002, 003...)
- Migrations tracked in `schema_version` table with version number and timestamp
- Must be run explicitly via `npm run migrate`
- Supports dry-run mode to preview changes without applying
- Creates automatic backup before migration (e.g., `ledger.db.backup.20240115_143052`)

**Current schema version:** v7 (see [Domain Model](docs/04-domain-model.md) for migration history)

### Number Formatting

European locale formatting via `src/utils/formatters.ts`:
- `formatNumber(value, decimals)` - Narrow no-break space thousand separator, comma decimal
- `formatEuro(value, decimals)` - With € symbol

### Rate Limiting
- CoinMarketCap requests queued with 1-second delay
- 5-minute cache TTL checked in `RatesRepository.getCachedRate()`
- Cache invalidated if expired

### Type Safety
- Strict TypeScript config (`strict: true`)
- Zod validators for config and user input
- Type definitions in `src/models/`

## Adding New Features

### Adding a New Migration
1. Create SQL file in `src/database/migrations/ledger/` with next version number (e.g., `008_new_feature.sql`)
2. Add migration entry to `MIGRATIONS` array in `src/database/migrations/runner.ts`
3. Update model interfaces in `src/models/` to match schema changes
4. Update repository methods in `src/database/ledger.ts`
5. Test migration: `npm run migrate -- --dry-run`
6. Apply migration: `npm run migrate`
7. **Update the [Domain Model](https://www.notion.so/julienderay/Domain-Model-2ec3c026f755817689f9ff4acb111000) Notion page** with schema version and entity changes

### Adding a New API Endpoint
1. Create route file in `src/api/routes/`
2. Define request/response schemas with Zod
3. Implement route handler using services
4. Register route in `src/api/server.ts`
5. Add tests in `tests/api/`

### Adding a New Service
1. Create service file in `src/services/`
2. Define typed error classes in `src/errors/index.ts`
3. Implement pure functions that return errors instead of throwing
4. Add corresponding API endpoint or integrate with existing endpoints

### Adding a New Claude Tool
1. Add tool definition to `TOOL_DEFINITIONS` in `services/claude.ts`
2. Add tool executor case in `QueryProcessor.processQuery()`
3. Implement tool logic using repositories
4. Return structured data (JSON serializable)

## Code Conventions

- Use ESLint and Prettier (configs in repo root)
- Prefer async/await over promises
- Close database connections in finally blocks
- Validate user input with Zod schemas
- Handle errors gracefully with user-friendly messages

## Troubleshooting

**Import errors with `.js` extensions:**
- TypeScript with ESM requires `.js` in import paths even for `.ts` files
- Compiler transforms these correctly

**Database locked errors:**
- Ensure `DatabaseManager.closeAll()` is called
- Check for multiple processes accessing same DB file

**CoinMarketCap API 401:**
- Verify API key in `.env` or config file
- Check key is passed to `CoinMarketCapService` constructor

**Claude API errors:**
- Verify ANTHROPIC_API_KEY is set
- Check model name is valid (currently using `claude-3-5-sonnet-20241022`)

## Technical Documentation

Detailed technical documentation is in the `docs/` folder:

| Document | Description |
|----------|-------------|
| [Getting Started](docs/01-getting-started.md) | Prerequisites, installation, API keys, quick start guide |
| [User Guide](docs/02-user-guide.md) | API and web UI reference |
| [Architecture](docs/03-architecture.md) | System design, database architecture, service layer, data flows |
| [Domain Model](docs/04-domain-model.md) | Entities, relationships, schema versioning (v1-v7) |
| [Developer Guide](docs/05-developer-guide.md) | Adding features, ESM requirements, code conventions, testing |
| [API Reference](docs/06-api-reference.md) | Service interfaces, repository methods, error codes, Claude tools |
| [Operations](docs/07-operations.md) | Migrations, backups, rate limiting, troubleshooting |

## External Documentation

Product documentation is maintained in Notion:
- [Product Vision](https://www.notion.so/2ec3c026f7558181b246cf92929991b5)
- [Domain Model](https://www.notion.so/2ec3c026f755817689f9ff4acb111000)
- [Roadmap](https://www.notion.so/2ec3c026f75581fea24cd2ea1ee3eadb)
- [Backlog](https://www.notion.so/06d296d7846a4e27b0e8dd757c816660)
