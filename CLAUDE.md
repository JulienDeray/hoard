# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based CLI application for tracking crypto assets with natural language queries powered by Claude AI. Users can manually enter monthly snapshots of their crypto holdings and ask questions about their portfolio using natural language.

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
│       └── portfolio.ts            # Portfolio analytics
├── database/
│   ├── connection.ts               # DatabaseManager singleton
│   ├── ledger.ts                   # LedgerRepository (snapshots, holdings, assets)
│   ├── rates.ts                    # RatesRepository (price data)
│   └── migrations/
│       ├── ledger/001_initial.sql  # Ledger schema
│       └── rates/001_initial.sql   # Rates schema
├── services/
│   ├── coinmarketcap.ts            # CoinMarketCap API client (rate-limited)
│   ├── claude.ts                   # Claude API with tool definitions
│   ├── portfolio.ts                # Portfolio calculations
│   └── query-processor.ts          # Tool executor for Claude
├── models/
│   ├── snapshot.ts, holding.ts, asset.ts, rate.ts
│   └── index.ts                    # Barrel export
└── utils/
    ├── config.ts                   # Config management with Conf
    ├── logger.ts                   # Chalk-based logger
    └── validators.ts               # Zod validators

scripts/
└── init.ts                         # Database + config initialization

data/                               # Runtime SQLite databases (gitignored)
```

## Database Architecture

### Two SQLite Databases

1. **Ledger DB** (`data/ledger.db`) - User data
   - `snapshots` - Monthly portfolio snapshots (id, date, notes)
   - `holdings` - Crypto amounts per snapshot (snapshot_id FK, asset_symbol, amount)
   - `assets` - Asset metadata (symbol PK, name, cmc_id)

2. **Rates DB** (`data/rates.db`) - Market data
   - `historical_rates` - Historical prices with timestamp
   - `rate_cache` - Current prices (5-minute TTL)

### Database Access Pattern

- `DatabaseManager.getLedgerDb(path)` - Returns singleton ledger DB instance
- `DatabaseManager.getRatesDb(path)` - Returns singleton rates DB instance
- Repositories (`LedgerRepository`, `RatesRepository`) wrap DB operations
- Migrations run automatically on first connection

## Common Commands

```bash
# Development
npm run dev [command]              # Run CLI in dev mode with tsx
npm run build                       # Compile TypeScript to dist/
npm start                           # Run compiled CLI

# Project setup
npm run init                        # Initialize databases and config

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
- SQL files in `src/database/migrations/{ledger,rates}/`
- Executed on first connection in `DatabaseManager`
- Use `IF NOT EXISTS` for idempotency

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

### Adding a New Asset Property
1. Update migration SQL in `migrations/ledger/`
2. Update `Asset` interface in `models/asset.ts`
3. Update `LedgerRepository.createAsset()` and related methods
4. Run `npm run init` to apply migration (or add new migration file)

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
