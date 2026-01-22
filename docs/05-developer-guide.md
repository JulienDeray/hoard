# Developer Guide

Instructions for developing new features, understanding the codebase, and following project conventions.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Project Structure](#project-structure)
3. [ESM Module Requirements](#esm-module-requirements)
4. [Adding New Features](#adding-new-features)
5. [Code Conventions](#code-conventions)
6. [Testing Strategy](#testing-strategy)
7. [Development Workflow](#development-workflow)

---

## Quick Reference

| Item | Value |
|------|-------|
| **Node Version** | v22.19.0 (required) |
| **Package Manager** | npm |
| **Language** | TypeScript (ESM modules) |
| **Database** | SQLite (better-sqlite3) |
| **Test Framework** | Vitest |
| **CLI Framework** | Commander.js + @clack/prompts |
| **Linting** | ESLint |
| **Formatting** | Prettier |

### Common Commands

```bash
npm run dev [command]         # Run CLI in dev mode
npm run build                 # Compile TypeScript
npm test                      # Run tests
npm run lint                  # Run ESLint
npm run format                # Run Prettier
npm run dev migrate           # Run database migrations
```

---

## Project Structure

```
src/
├── cli/                          # Command-line interface
│   ├── index.ts                  # Main CLI entry point
│   ├── utils/
│   │   └── error-handler.ts      # Centralized error handling
│   └── commands/
│       ├── snapshot.ts           # Snapshot management
│       ├── query.ts              # Natural language queries
│       ├── portfolio.ts          # Portfolio analytics
│       ├── allocation.ts         # Allocation targets
│       ├── migrate.ts            # Database migrations
│       └── env.ts                # Environment management
│
├── database/
│   ├── connection.ts             # DatabaseManager singleton
│   ├── ledger.ts                 # LedgerRepository
│   ├── rates.ts                  # RatesRepository
│   └── migrations/
│       ├── runner.ts             # Migration runner
│       ├── backfill.ts           # Data backfill functions
│       ├── ledger/               # Ledger schema migrations
│       └── rates/                # Rates schema migrations
│
├── services/
│   ├── snapshot.ts               # Snapshot operations
│   ├── portfolio.ts              # Portfolio value calculations
│   ├── allocation.ts             # Allocation comparisons
│   ├── allocation-target.ts      # Target management
│   ├── property.ts               # Real estate operations
│   ├── liability.ts              # Liability management
│   ├── coinmarketcap.ts          # CoinMarketCap API client
│   ├── claude.ts                 # Claude AI integration
│   └── query-processor.ts        # Tool execution
│
├── models/
│   ├── snapshot.ts, holding.ts, asset.ts, rate.ts
│   ├── allocation.ts, liability.ts, property.ts
│   └── index.ts                  # Barrel export
│
├── errors/
│   └── index.ts                  # Typed error classes
│
└── utils/
    ├── config.ts                 # Configuration management
    ├── formatters.ts             # Number/Euro formatting
    ├── logger.ts                 # Logging utility
    └── validators.ts             # Zod validators

tests/
├── helpers/                      # Test utilities
│   ├── database-setup.ts         # Test DB initialization
│   └── mock-factories.ts         # Mock object builders
├── services/                     # Service unit tests
├── database/                     # Repository integration tests
└── utils/                        # Utility function tests

data/
├── dev/                          # Development databases
└── prod/                         # Production databases
```

---

## ESM Module Requirements

This project uses ES Modules (ESM) exclusively. **This is critical to understand.**

### Rule 1: Always Use `.js` Extensions in Imports

```typescript
// CORRECT
import { DatabaseManager } from '../../database/connection.js';
import { PortfolioService } from '../../services/portfolio.js';

// WRONG - will cause runtime errors
import { DatabaseManager } from '../../database/connection';
import { PortfolioService } from '../../services/portfolio.ts';
```

TypeScript compiles `.ts` files to `.js` files. ESM requires explicit extensions, so you must use `.js` in your imports even when the source file is `.ts`.

### Rule 2: Use import.meta.url for __dirname

```typescript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Now use __dirname normally
const schemaPath = join(__dirname, 'migrations', 'schema.sql');
```

### Rule 3: Check package.json

The project has `"type": "module"` in package.json, which enables ESM.

### Why This Matters

If you forget the `.js` extension, you'll see errors like:

```
Error: Cannot find module '/path/to/connection'
```

The fix is always: add `.js` to the import path.

---

## Adding New Features

### Adding a New CLI Command

**Step 1: Create the command file**

```typescript
// src/cli/commands/my-command.ts
import { Command } from 'commander';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { DatabaseManager } from '../../database/connection.js';
import { LedgerRepository } from '../../database/ledger.js';
import { configManager } from '../../utils/config.js';
import { Logger } from '../../utils/logger.js';
import { getCurrentEnvironment } from '../index.js';

export const myCommand = new Command('my-command')
  .description('Description of what this command does')
  .option('--verbose', 'Show detailed output')
  .addCommand(
    new Command('subcommand')
      .description('A subcommand')
      .action(handleSubcommand)
  );

function initializeServices() {
  const env = getCurrentEnvironment();
  const config = configManager.getWithEnvironment(env);
  const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
  const ledgerRepo = new LedgerRepository(ledgerDb);
  return { config, ledgerRepo };
}

async function handleSubcommand() {
  clack.intro('My Command');

  try {
    const { ledgerRepo } = initializeServices();

    // Your logic here

    DatabaseManager.closeAll();
    clack.outro('Success!');
  } catch (error) {
    Logger.error(error instanceof Error ? error.message : String(error));
    DatabaseManager.closeAll();
    clack.outro('Operation failed');
    process.exit(1);
  }
}
```

**Step 2: Register the command**

```typescript
// src/cli/index.ts
import { myCommand } from './commands/my-command.js';

// Add with other command registrations
program.addCommand(myCommand);
```

**Step 3: Follow these patterns:**

- Initialize services with `getCurrentEnvironment()` and `configManager`
- Always call `DatabaseManager.closeAll()` in finally blocks
- Use `@clack/prompts` for user interaction
- Use `Logger` instead of `console.log`
- Use `picocolors` for colored output (never `pc.gray()`)

---

### Adding a New Service

**Step 1: Create the service file**

```typescript
// src/services/my-service.ts
import type { LedgerRepository } from '../database/ledger.js';
import { MyCustomError } from '../errors/index.js';

export class MyService {
  constructor(private ledgerRepo: LedgerRepository) {}

  doSomething(input: string): string {
    if (!input) {
      throw new MyCustomError('Input is required');
    }
    return `Result: ${input}`;
  }

  async fetchData(id: number) {
    const data = this.ledgerRepo.getById(id);
    if (!data) {
      throw new MyCustomError(`Item ${id} not found`);
    }
    return data;
  }
}
```

**Step 2: Create typed errors**

```typescript
// src/errors/index.ts
export class MyCustomError extends ServiceError {
  constructor(message: string) {
    super(message, 'MY_CUSTOM_ERROR');
  }
}
```

**Key principles:**

- Pure functions: No side effects, deterministic outputs
- Dependency injection: Constructor inject repositories
- Typed errors: Throw specific error types, not generic Error
- No CLI dependencies: Services don't know about Commander or clack

---

### Adding a Database Migration

**Step 1: Create SQL file**

```sql
-- src/database/migrations/ledger/008_my_migration.sql
-- Migration: 008 - Description of changes

ALTER TABLE snapshots ADD COLUMN new_field TEXT;
CREATE INDEX idx_snapshots_new_field ON snapshots(new_field);
```

**Step 2: Register the migration**

```typescript
// src/database/migrations/runner.ts
const MIGRATIONS: Migration[] = [
  // ... existing migrations ...
  {
    version: 8,
    description: 'Description of changes',
    sql: '008_my_migration.sql',
  },
];
```

**Step 3: Update schema version**

```typescript
// src/database/connection.ts
const EXPECTED_SCHEMA_VERSION = 8;
```

**Step 4: Run the migration**

```bash
npm run dev migrate --dry-run  # Preview
npm run dev migrate            # Apply
```

**Step 5: Update model types**

```typescript
// src/models/snapshot.ts
export interface Snapshot {
  // ... existing fields ...
  new_field?: string;
}
```

---

### Adding a New Claude Tool

**Step 1: Define the tool**

```typescript
// src/services/claude.ts
const TOOL_DEFINITIONS = [
  // ... existing tools ...
  {
    name: 'my_tool',
    description: 'What this tool does',
    input_schema: {
      type: 'object',
      properties: {
        param1: {
          type: 'string',
          description: 'Description of param1',
        },
      },
      required: ['param1'],
    },
  },
];
```

**Step 2: Implement the executor**

```typescript
// src/services/query-processor.ts
async processQuery(toolName: string, toolInput: any) {
  switch (toolName) {
    case 'my_tool': {
      const result = await this.handleMyTool(toolInput);
      return JSON.stringify(result);
    }
    // ... other cases ...
  }
}

private async handleMyTool(input: { param1: string }) {
  const data = this.ledgerRepo.getData(input.param1);
  return { success: true, data };
}
```

---

## Code Conventions

### TypeScript Style

```typescript
// Use strict types
const value: number = 42;
const items: string[] = ['a', 'b'];

// Use const by default
const config = { key: 'value' };

// Use arrow functions
const add = (a: number, b: number): number => a + b;

// Use async/await
const data = await fetchData();

// Avoid 'any'
const result: unknown = getValue();
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `portfolio-service.ts` |
| Classes | PascalCase | `PortfolioService` |
| Functions | camelCase | `calculateTotal` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Private fields | prefix with `_` | `private _cache` |

### Color Output

**Never use `pc.gray()`** — it's hard to read on dark terminals.

| Color | Use For |
|-------|---------|
| `pc.cyan()` | Informational details, paths |
| `pc.green()` | Success messages |
| `pc.yellow()` | Warnings |
| `pc.red()` | Errors |
| `pc.bold()` | Headings |

### Linting and Formatting

```bash
npm run lint      # Check for issues
npm run format    # Auto-format code
```

ESLint and Prettier configs are in the repo root.

---

## Testing Strategy

### Test Structure

```
Unit Tests (majority)
├── Services: Business logic
├── Repositories: Database operations
└── Utils: Helper functions

Integration Tests
├── Database: Real SQLite operations
└── Service coordination

E2E Tests (fewer)
└── CLI command execution
```

### Writing a Service Test

```typescript
// tests/services/portfolio.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PortfolioService } from '../../src/services/portfolio.js';
import { mockHolding } from '../helpers/mock-factories.js';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let mockLedgerRepo: any;
  let mockRatesRepo: any;

  beforeEach(() => {
    mockLedgerRepo = {
      getHoldingsByDate: vi.fn(),
    };
    mockRatesRepo = {
      getCachedRate: vi.fn(),
    };
    service = new PortfolioService(mockLedgerRepo, mockRatesRepo, {}, 'EUR');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPortfolioValue', () => {
    it('should calculate portfolio value from holdings', async () => {
      // Arrange
      const holdings = [mockHolding({ amount: 0.5 })];
      mockLedgerRepo.getHoldingsByDate.mockReturnValue(holdings);
      mockRatesRepo.getCachedRate.mockReturnValue({ price: 45000 });

      // Act
      const result = await service.getPortfolioValue('2025-01-22');

      // Assert
      expect(result?.totalValue).toBe(22500);
    });
  });
});
```

### Writing a Database Test

```typescript
// tests/database/ledger.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { LedgerRepository } from '../../src/database/ledger.js';
import { setupTestLedgerDb } from '../helpers/database-setup.js';

describe('LedgerRepository', () => {
  let db: Database.Database;
  let repo: LedgerRepository;

  beforeEach(() => {
    db = setupTestLedgerDb();  // In-memory database
    repo = new LedgerRepository(db);
  });

  it('should retrieve snapshot by date', () => {
    const snapshot = repo.getSnapshotByDate('2025-01-22');
    expect(snapshot).toBeDefined();
  });
});
```

### Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # With coverage
npm run test:ui             # UI dashboard
```

---

## Development Workflow

### Feature Development Checklist

1. **Create branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Plan implementation**
   - [ ] Need a new service?
   - [ ] Need database migration?
   - [ ] Need CLI command?
   - [ ] Need new model types?

3. **Implement in order**
   - [ ] Update models (if needed)
   - [ ] Run migrations (if needed)
   - [ ] Implement services
   - [ ] Add CLI command
   - [ ] Write tests

4. **Test thoroughly**
   ```bash
   npm run lint
   npm run format
   npm test
   npm run build
   ```

5. **Update documentation**
   - [ ] Update Notion Domain Model (for schema changes)
   - [ ] Update CLAUDE.md (for significant changes)

6. **Commit and push**
   ```bash
   git add .
   git commit -m "Brief description"
   git push origin feature/my-feature
   ```

### Common Development Tasks

**Add a new asset type:**

1. Add to `AssetClass` enum in `src/models/asset.ts`
2. Create service if needed (e.g., `StockService`)
3. Implement valuation logic
4. Add CLI command

**Add a new external API:**

1. Create client service (e.g., `YahooFinanceService`)
2. Implement rate limiting
3. Create error types
4. Integrate with PortfolioService

**Debug a failing test:**

```bash
# Run single test file
npm test -- tests/services/portfolio.test.ts

# Run with verbose output
npm test -- --reporter=verbose

# Run specific test
npm test -- -t "should calculate portfolio value"
```

---

## Resources

- **CLAUDE.md** - Project overview and conventions
- **Domain Model** - Notion page with schema documentation
- **Acceptance Criteria** - `docs/acceptance-criteria/`
- **TypeScript Handbook** - https://www.typescriptlang.org/docs/
- **Vitest Documentation** - https://vitest.dev/

---

**Last Updated:** January 2025
