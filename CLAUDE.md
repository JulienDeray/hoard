# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based CLI application for multi-asset wealth management with natural language queries powered by Claude AI. Users can track portfolios with crypto, stocks, real estate, and other assets, manage liabilities, and ask questions using natural language.

## Tech Stack

- **Language:** TypeScript (ESM modules)
- **Database:** SQLite with better-sqlite3
- **CLI Framework:** Commander + Inquirer
- **APIs:**
  - Anthropic Claude API (natural language processing)
  - CoinMarketCap API (crypto price data)
- **Key Dependencies:** axios, zod, chalk, ora, date-fns

## Project Structure

```
src/
├── cli/
│   ├── index.ts                    # Main CLI entry point
│   └── commands/
│       ├── snapshot.ts             # Snapshot management (add/list/view)
│       ├── query.ts                # Natural language query interface
│       ├── portfolio.ts            # Portfolio analytics
│       ├── allocation.ts           # Allocation targets management
│       └── migrate.ts              # Database migration command
├── database/
│   ├── connection.ts               # DatabaseManager singleton
│   ├── ledger.ts                   # LedgerRepository (snapshots, holdings, assets, liabilities)
│   ├── rates.ts                    # RatesRepository (price data)
│   └── migrations/
│       ├── runner.ts               # Migration runner with versioning
│       ├── backfill.ts             # Data backfill functions
│       ├── ledger/                 # Ledger schema migrations
│       │   ├── 001_initial.sql
│       │   ├── 002_allocation_targets.sql
│       │   └── 003_schema_v2.sql   # Multi-asset schema
│       └── rates/001_initial.sql   # Rates schema
├── services/
│   ├── coinmarketcap.ts            # CoinMarketCap API client (rate-limited)
│   ├── claude.ts                   # Claude API with tool definitions
│   ├── portfolio.ts                # Portfolio calculations
│   ├── allocation.ts               # Allocation/rebalancing logic
│   └── query-processor.ts          # Tool executor for Claude
├── models/
│   ├── snapshot.ts, holding.ts, asset.ts, rate.ts, allocation.ts
│   ├── liability.ts                # Liability and balance models
│   └── index.ts                    # Barrel export
└── utils/
    ├── config.ts                   # Config management with Conf
    ├── logger.ts                   # Chalk-based logger
    └── validators.ts               # Zod validators

scripts/
└── init.ts                         # Database + config initialization

data/                               # Runtime SQLite databases (gitignored)
├── dev/                            # Development databases
└── prod/                           # Production databases
```

## Database Architecture

### Two SQLite Databases

1. **Ledger DB** (`data/{env}/ledger.db`) - User data
   - `snapshots` - Portfolio snapshots with totals (id, date, notes, total_assets_eur, net_worth_eur)
   - `holdings` - Asset amounts per snapshot (snapshot_id FK, asset_id FK, amount, value_eur)
   - `assets` - Multi-type asset metadata (id PK, symbol, name, asset_class, valuation_source)
   - `allocation_targets` - Portfolio allocation targets (target_type, target_key, target_percentage)
   - `liabilities` - Loans/mortgages (name, type, original_amount, interest_rate)
   - `liability_balances` - Liability amounts per snapshot (snapshot_id FK, liability_id FK, outstanding_amount)
   - `schema_version` - Tracks applied migrations

2. **Rates DB** (`data/{env}/rates.db`) - Market data
   - `historical_rates` - Historical prices with timestamp
   - `rate_cache` - Current prices (5-minute TTL)

### Asset Classes
- CRYPTO, FIAT, STOCK, REAL_ESTATE, COMMODITY, OTHER

### Database Access Pattern

- `DatabaseManager.getLedgerDb(path)` - Returns singleton ledger DB instance
- `DatabaseManager.getRatesDb(path)` - Returns singleton rates DB instance
- Repositories (`LedgerRepository`, `RatesRepository`) wrap DB operations
- Migrations must be run explicitly via `npm run dev migrate`

## Common Commands

```bash
# Development
npm run dev [command]              # Run CLI in dev mode with tsx
npm run dev --env prod [command]   # Run against production database
npm run build                       # Compile TypeScript to dist/
npm start                           # Run compiled CLI

# Project setup
npm run init                        # Initialize databases and config

# Database migrations
npm run dev migrate                 # Run pending migrations (dev)
npm run dev migrate --dry-run       # Preview migrations without applying
npm run dev migrate --status        # Show current schema version
npm run dev migrate --backfill      # Run data backfill operations
npm run dev --env prod migrate      # Run migrations on production

# Testing and quality
npm test                            # Run Vitest tests
npm run lint                        # ESLint
npm run format                      # Prettier

# CLI commands (via npm run dev)
snapshot add                        # Interactive snapshot entry
snapshot list                       # List all snapshots
snapshot view <date>                # View snapshot details
query "question"                    # Natural language query
portfolio summary                   # Current portfolio value
allocation set                      # Set allocation targets
allocation compare                  # Compare current vs target allocations
```

## Key Architecture Patterns

### Configuration Management

- Uses `conf` package for persistent config in `./config.json`
- `configManager` singleton (src/utils/config.ts)
- Validates with Zod schema
- Supports environment variables from `.env` file
- API keys stored in config or env vars

### Service Layer

**PortfolioService** - Core business logic
- Enriches holdings with prices (cached or from API)
- Calculates portfolio values for any date
- Coordinates between ledger, rates, and CoinMarketCap

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

### CLI Commands

All commands follow this pattern:
1. Load config with `configManager.get()`
2. Initialize database connections via `DatabaseManager`
3. Create repositories and services
4. Execute command logic
5. Close connections with `DatabaseManager.closeAll()`

**Pre-action hook** checks config is initialized (except for init/help commands)

### Error Handling

- Logger utility (chalk-based) for consistent output: `Logger.success()`, `Logger.error()`, etc.
- Global handlers for uncaught exceptions and unhandled rejections
- Graceful database cleanup in try/catch/finally blocks
- Spinner (ora) for long-running operations

## Data Flow Examples

### Adding a Snapshot
1. CLI prompts for date, notes, asset amounts (inquirer)
2. `LedgerRepository.createSnapshot()` creates snapshot row
3. For each asset: `createHolding()` creates holding row
4. Optional: Fetch prices via `CoinMarketCapService`
5. `RatesRepository.updateCachedRate()` saves to cache + historical_rates

### Natural Language Query
1. User: "How much Bitcoin do I have?"
2. `QueryProcessor.processQuery()` sends to `ClaudeService`
3. Claude responds with tool_use: `get_holdings()`
4. QueryProcessor executes: `ledgerRepo.getLatestHoldings()`
5. Results sent back to Claude
6. Claude formats response: "You have 0.5 BTC"
7. Response displayed to user

### Portfolio Valuation
1. `PortfolioService.getPortfolioValue(date?)`
2. Gets holdings from ledger for date
3. For each holding:
   - If current: check `rate_cache`, else fetch from CoinMarketCap
   - If historical: query `historical_rates` table
4. Calculates value = amount × price
5. Returns `PortfolioSummary` with total and breakdown

## Important Implementation Details

### ESM Modules
- `package.json` has `"type": "module"`
- Use `.js` extensions in import paths (TypeScript ESM requirement)
- Use `import.meta.url` and `fileURLToPath` for `__dirname` equivalents

### Database Migrations
The project uses a versioned migration system managed by `MigrationRunner`:

- SQL files in `src/database/migrations/ledger/` numbered sequentially (001, 002, 003...)
- Migrations tracked in `schema_version` table with version number and timestamp
- Must be run explicitly via `npm run dev migrate`
- Supports dry-run mode to preview changes without applying
- Creates automatic backup before migration (e.g., `ledger.db.backup.20240115_143052`)

**Migration Flow:**
1. Runner detects current version from `schema_version` table
2. For legacy databases without `schema_version`, detects version from existing tables
3. Runs pending migrations in order within transaction
4. Records each migration in `schema_version` after success
5. Optional backfill operations populate computed columns

### Rate Limiting
- CoinMarketCap requests queued with 1-second delay
- 5-minute cache TTL checked in `RatesRepository.getCachedRate()`
- Cache invalidated if expired

### Type Safety
- Strict TypeScript config (`strict: true`)
- Zod validators for config and user input
- Type definitions in `src/models/`

## Testing Strategy

This project uses Vitest with a testing pyramid approach:
- **Unit tests**: Services, repositories, utilities (majority of tests)
- **Integration tests**: Database operations, service coordination
- **E2E tests**: CLI command execution (fewer tests)

### Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # With coverage
```

### Writing Tests

Use the Testing Workflow Skill for automated test creation and maintenance.

**Test locations:**
- Service tests: `tests/services/`
- Repository tests: `tests/database/`
- CLI tests: `tests/cli/`
- Test helpers: `tests/helpers/`

**Mocking:**
- External APIs (CoinMarketCap, Claude) are always mocked
- Database tests use in-memory SQLite (`:memory:`)
- CLI prompts are mocked using vi.mock

### Acceptance Criteria

Feature acceptance criteria are documented in `docs/acceptance-criteria/`.
Each feature should have:
- User story
- Acceptance criteria in Given/When/Then format
- Test cases
- Error handling requirements

**When developing features:**
1. Write/update acceptance criteria first
2. Implement the feature
3. Write tests covering all ACs
4. Run tests and ensure they pass
5. Update documentation

## Adding New Features

### Adding a New Migration
1. Create SQL file in `src/database/migrations/ledger/` with next version number (e.g., `004_new_feature.sql`)
2. Add migration entry to `MIGRATIONS` array in `src/database/migrations/runner.ts`:
   ```typescript
   {
     version: 4,
     description: 'New feature description',
     sql: '004_new_feature.sql',
   }
   ```
3. Update model interfaces in `src/models/` to match schema changes
4. Update repository methods in `src/database/ledger.ts`
5. Test migration: `npm run dev migrate --dry-run`
6. Apply migration: `npm run dev migrate`

### Adding a New Asset Property
1. Create new migration SQL file with ALTER TABLE or table recreation
2. Update `Asset` interface in `models/asset.ts`
3. Update `LedgerRepository.createAsset()` and related methods
4. Run `npm run dev migrate` to apply

### Adding a New CLI Command
1. Create command file in `src/cli/commands/`
2. Export Command instance with `.action()` handler
3. Import and register in `src/cli/index.ts` with `program.addCommand()`
4. Follow pattern: load config → init DBs → execute → close DBs

### Adding a New Claude Tool
1. Add tool definition to `TOOL_DEFINITIONS` in `services/claude.ts`
2. Add tool executor case in `QueryProcessor.processQuery()`
3. Implement tool logic using repositories
4. Return structured data (JSON serializable)

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

## Code Conventions

- Use ESLint and Prettier (configs in repo root)
- Prefer async/await over promises
- Use `Logger` utility instead of `console.log`
- Close database connections in finally blocks
- Validate user input with Zod schemas
- Handle errors gracefully with user-friendly messages

### CLI Output Colors (picocolors)

**IMPORTANT:** Never use `pc.gray()` for terminal output in this project - it's hard to read.

Approved color scheme:
- `pc.cyan()` - informational messages, details, paths, supplementary info
- `pc.green()` - success messages, confirmations
- `pc.yellow()` - warnings, skipped items, things that need attention
- `pc.red()` - errors, failures
- `pc.bold()` - headings, emphasis
- `pc.dim()` - avoid using, use cyan instead

When writing CLI output:
- Use cyan for any detailed/secondary information (file paths, line numbers, asset names, etc.)
- Reserve yellow for actual warnings/cautions
- Use green for successful operations
- Use red for errors only
