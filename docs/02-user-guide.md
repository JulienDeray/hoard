# User Guide

Complete reference for using Hoard's command-line interface.

## Table of Contents

1. [CLI Overview](#cli-overview)
2. [Snapshot Management](#snapshot-management)
3. [Portfolio Analytics](#portfolio-analytics)
4. [Allocation Targets](#allocation-targets)
5. [Natural Language Queries](#natural-language-queries)
6. [Environment Management](#environment-management)
7. [Database Migrations](#database-migrations)
8. [Data Import](#data-import)

---

## CLI Overview

### Basic Usage

```bash
npm run dev [command] [subcommand] [options]
```

### Global Options

| Option | Description |
|--------|-------------|
| `--env <environment>` | Use dev or prod database (default: dev) |
| `--help` | Show help for any command |
| `--version` | Show version number |

### Available Commands

| Command | Description |
|---------|-------------|
| `snapshot` | Manage portfolio snapshots |
| `portfolio` | View portfolio analytics |
| `allocation` | Manage allocation targets |
| `query` | Natural language queries |
| `env` | Environment management |
| `migrate` | Database migrations |

---

## Snapshot Management

Snapshots capture your portfolio at a point in time. Record monthly snapshots to track your wealth over time.

### Add a Snapshot

```bash
npm run dev snapshot add
```

Interactive prompts guide you through:

1. **Date**: Enter snapshot date (YYYY-MM-DD format)
2. **Notes**: Optional description
3. **Holdings**: Enter each asset symbol and amount
4. **Liabilities**: Enter outstanding loan/mortgage balances

**Example session:**

```
◇  Snapshot date (YYYY-MM-DD):
│  2025-01-22

◇  Add a note for this snapshot?
│  Monthly review

◇  Enter asset symbol (or 'done' to finish):
│  BTC

◇  Amount of BTC:
│  0.5

◇  Enter asset symbol (or 'done' to finish):
│  ETH

◇  Amount of ETH:
│  5.0

◇  Enter asset symbol (or 'done' to finish):
│  done

✓ Snapshot created for 2025-01-22 with 2 holdings
```

**Asset Discovery:**

When you enter an unknown asset symbol, Hoard searches CoinMarketCap:

```
◇  Asset 'DOGE' not found locally. Search CoinMarketCap?
│  Yes

◇  Found: Dogecoin (DOGE)
│  Add to your assets? Yes

✓ Asset added: Dogecoin (DOGE)
```

### List Snapshots

```bash
npm run dev snapshot list
```

**Options:**

| Option | Description |
|--------|-------------|
| `--assets <symbols>` | Filter to specific assets (comma-separated) |
| `--last <n>` | Show only the last n snapshots |

**Examples:**

```bash
# List all snapshots
npm run dev snapshot list

# Show only BTC and ETH columns
npm run dev snapshot list --assets BTC,ETH

# Show last 3 snapshots
npm run dev snapshot list --last 3

# Combine filters
npm run dev snapshot list --assets BTC --last 5
```

**Output:**

```
Snapshots (12 total, showing last 3)

Date         Notes              BTC        ETH        Total EUR
─────────────────────────────────────────────────────────────────
2025-01-22   Monthly review     0.50       5.00       €36,250
2024-12-22   Year end           0.45       4.50       €32,100
2024-11-22   Post-rebalance     0.40       5.00       €29,800
```

### View Snapshot Details

```bash
npm run dev snapshot view <date>
```

**Example:**

```bash
npm run dev snapshot view 2025-01-22
```

**Output:**

```
Snapshot: 2025-01-22
Notes: Monthly review

Holdings:
  Symbol    Amount          Value EUR      % of Total
  ──────────────────────────────────────────────────
  BTC       0.50000000      €22,500.00     62.1%
  ETH       5.00000000      €13,750.00     37.9%

  Total Assets: €36,250.00

Liabilities:
  Name              Type        Outstanding
  ────────────────────────────────────────
  House Mortgage    MORTGAGE    €285,000.00

  Total Liabilities: €285,000.00

Net Worth: -€248,750.00
```

### Delete a Snapshot

```bash
npm run dev snapshot delete <date>
```

Delete entire snapshot:

```bash
npm run dev snapshot delete 2025-01-22
```

Delete specific holding from snapshot:

```bash
npm run dev snapshot delete 2025-01-22 BTC
```

**Confirmation required:**

```
◇  Delete snapshot for 2025-01-22 with 2 holdings?
│  Yes

✓ Deleted snapshot for 2025-01-22
```

---

## Portfolio Analytics

### Portfolio Summary

```bash
npm run dev portfolio summary
```

Shows current portfolio value with breakdown:

```
Portfolio Summary (2025-01-22)

Holdings:
  Asset     Amount          Price EUR      Value EUR      Allocation
  ─────────────────────────────────────────────────────────────────
  BTC       0.50000000      €45,000.00     €22,500.00     62.1%
  ETH       5.00000000      €2,750.00      €13,750.00     37.9%

Total Portfolio Value: €36,250.00
Currency: EUR

Prices as of: 2025-01-22 14:30:00
```

---

## Allocation Targets

Set target allocations and compare your current portfolio against them.

### Set Allocation Targets

```bash
npm run dev allocation set
```

Interactive prompt to define targets:

```
◇  Target type:
│  ● Asset (specific assets like BTC, ETH)
│  ○ Asset Class (categories like CRYPTO, STOCK)

◇  Select target type:
│  Asset

◇  Enter asset symbol:
│  BTC

◇  Target percentage for BTC:
│  50

◇  Tolerance percentage (default 2%):
│  2

◇  Add another target?
│  Yes

◇  Enter asset symbol:
│  ETH

◇  Target percentage for ETH:
│  50

◇  Add another target?
│  No

✓ Allocation targets saved (sum: 100%)
```

**Target Types:**

- **Asset**: Target specific assets (e.g., BTC: 50%, ETH: 50%)
- **Asset Class**: Target categories (e.g., CRYPTO: 60%, STOCK: 30%, FIAT: 10%)

**Special target: OTHER**

Use `OTHER` to capture all assets not explicitly targeted:

```
Targets:
  BTC: 40%
  ETH: 30%
  OTHER: 30%  ← captures SOL, DOGE, etc.
```

### View Allocation Targets

```bash
npm run dev allocation view
```

**Output:**

```
Allocation Targets

  Target          Type     Percentage   Tolerance
  ────────────────────────────────────────────────
  BTC             ASSET    50.0%        ±2.0%
  ETH             ASSET    50.0%        ±2.0%

  Total: 100.0%
```

### Compare Current vs Target

```bash
npm run dev allocation compare
```

**Options:**

| Option | Description |
|--------|-------------|
| `-d, --date <date>` | Compare for a specific snapshot date |

**Example:**

```bash
npm run dev allocation compare
npm run dev allocation compare -d 2024-12-22
```

**Output:**

```
Allocation Comparison (2025-01-22)

  Target    Current    Target     Diff       Status
  ──────────────────────────────────────────────────
  BTC       62.1%      50.0%      +12.1%     ⚠ OVERWEIGHT
  ETH       37.9%      50.0%      -12.1%     ⚠ UNDERWEIGHT

Portfolio Status: OUT OF BALANCE

Rebalancing Suggestions:
  • SELL €4,387.50 of BTC
  • BUY €4,387.50 of ETH
```

**Status indicators:**

- ✓ OK: Within tolerance
- ⚠ OVERWEIGHT: Above target + tolerance
- ⚠ UNDERWEIGHT: Below target - tolerance

### Clear Allocation Targets

```bash
npm run dev allocation clear
```

Removes all allocation targets after confirmation.

---

## Natural Language Queries

Ask questions about your portfolio in plain English.

### Basic Usage

```bash
npm run dev query "your question here"
```

### Example Queries

**Portfolio value:**

```bash
npm run dev query "What is my total portfolio worth?"
npm run dev query "How much is my portfolio worth in euros?"
```

**Specific assets:**

```bash
npm run dev query "How much Bitcoin do I have?"
npm run dev query "What's my ETH position worth?"
npm run dev query "Show me all my crypto holdings"
```

**Historical data:**

```bash
npm run dev query "What was my portfolio worth on January 1st?"
npm run dev query "How has my BTC holdings changed over the last 3 months?"
```

**Allocation and rebalancing:**

```bash
npm run dev query "Am I on target with my allocation?"
npm run dev query "How should I rebalance my portfolio?"
npm run dev query "What should I buy or sell to match my targets?"
```

**Comparisons:**

```bash
npm run dev query "Compare my current holdings to last month"
npm run dev query "How much has my portfolio grown this year?"
```

### Available Claude Tools

Claude uses these tools to answer your questions:

| Tool | Description |
|------|-------------|
| `get_holdings` | Retrieve holdings for a snapshot date |
| `calculate_portfolio_value` | Calculate total value with prices |
| `get_historical_price` | Get price for a specific date |
| `list_snapshots` | List all available snapshots |
| `suggest_rebalancing` | Get rebalancing suggestions |

---

## Environment Management

Hoard supports separate dev and prod databases.

### Check Current Environment

```bash
npm run dev env
```

**Output:**

```
Environment: dev
  Database path: /path/to/wealth-management/data/dev
  Ledger DB: ✓ exists (schema v7)
  Rates DB: ✓ exists
  ✓ ANTHROPIC_API_KEY configured
  ✓ COINMARKETCAP_API_KEY configured
```

### Switch Environments

Use the `--env` flag with any command:

```bash
# Development (default)
npm run dev snapshot list

# Production
npm run dev -- --env prod snapshot list
```

### Seed Dev from Prod

Copy production data to development for testing:

```bash
npm run dev env seed
```

This copies:
- All snapshots and holdings
- All assets and liabilities
- Allocation targets

**Note:** Rates data is not copied (fetched fresh from API).

---

## Database Migrations

Update database schema when upgrading Hoard.

### Check Migration Status

```bash
npm run dev migrate --status
```

**Output:**

```
Schema Version Information:
  Current version: 7

Applied Migrations:
  ✓ v1: Initial schema (2025-12-13)
  ✓ v2: Allocation targets (2025-12-28)
  ...
  ✓ v7: Add asset metadata (2026-01-15)

Pending Migrations:
  (none)
```

### Run Migrations

```bash
# Preview changes (recommended first)
npm run dev migrate --dry-run

# Apply migrations
npm run dev migrate
```

### Production Migrations

```bash
# Always dry-run first on production
npm run dev -- --env prod migrate --dry-run

# Then apply
npm run dev -- --env prod migrate
```

### Run Backfill Operations

```bash
npm run dev migrate --backfill
```

Backfill recalculates cached values after schema changes.

---

## Data Import

### Import from Koinly

Import historical snapshots from Koinly CSV exports.

```bash
npm run import-koinly
```

**Options:**

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview without importing |
| `--force` | Overwrite existing snapshots |
| `--dir <path>` | Custom directory for CSV files |

**Example:**

```bash
# Preview import
npm run import-koinly -- --dry-run

# Import with overwrite
npm run import-koinly -- --force

# Import from custom directory
npm run import-koinly -- --dir ~/Downloads/koinly
```

See [Koinly Import Guide](./koinly-import.md) for detailed instructions.

---

## Common Workflows

### Monthly Portfolio Review

```bash
# 1. Add new snapshot
npm run dev snapshot add

# 2. View portfolio summary
npm run dev portfolio summary

# 3. Check allocation drift
npm run dev allocation compare

# 4. Ask specific questions
npm run dev query "How has my portfolio changed since last month?"
```

### Setting Up a New Portfolio

```bash
# 1. Initialize databases
npm run init

# 2. Set your allocation targets
npm run dev allocation set

# 3. Add your current holdings
npm run dev snapshot add

# 4. Compare to targets
npm run dev allocation compare
```

### Analyzing Historical Performance

```bash
# List all snapshots
npm run dev snapshot list

# View specific snapshot
npm run dev snapshot view 2024-01-15

# Ask Claude for analysis
npm run dev query "What was my best performing month this year?"
```

---

**Last Updated:** January 2025
