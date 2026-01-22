# Getting Started

This guide walks you through setting up Hoard, a personal CFO platform for multi-asset wealth management.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [API Key Setup](#api-key-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Initialization](#database-initialization)
6. [Quick Start Guide](#quick-start-guide)
7. [Next Steps](#next-steps)

---

## Prerequisites

### Node.js Version

**Required:** Node v22.19.0

Hoard requires this specific Node version. Use [nvm](https://github.com/nvm-sh/nvm) to manage Node versions:

```bash
# Install the required version
nvm install 22.19.0

# Use it (or add to your shell profile)
nvm use 22.19.0

# Verify
node --version
# Should output: v22.19.0
```

The project includes an `.nvmrc` file, so you can also run:

```bash
nvm use
```

### Package Manager

npm (comes with Node.js)

---

## Installation

### Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url> wealth-management
cd wealth-management

# Install dependencies
npm install
```

### Verify Installation

```bash
# Check that the CLI runs
npm run dev -- --help
```

You should see the available commands listed.

---

## API Key Setup

Hoard integrates with two external APIs:

### 1. CoinMarketCap API (Cryptocurrency Prices)

CoinMarketCap provides real-time and historical cryptocurrency price data.

**Get a free API key:**

1. Visit [https://coinmarketcap.com/api/](https://coinmarketcap.com/api/)
2. Click "Get Your Free API Key Now"
3. Sign up for a free account
4. Copy your API key from the dashboard

**Free tier limits:**
- ~333 calls/day (varies)
- Hoard uses conservative rate limiting (1 call/second max)
- Prices are cached for 5 minutes

### 2. Anthropic Claude API (Natural Language Queries)

Claude powers the natural language query feature, allowing you to ask questions about your portfolio in plain English.

**Get an API key:**

1. Visit [https://console.anthropic.com/](https://console.anthropic.com/)
2. Create an account
3. Navigate to API Keys in settings
4. Create a new API key

---

## Environment Configuration

### Option 1: Using .env File (Recommended)

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit with your API keys
nano .env  # or use your preferred editor
```

Contents of `.env`:

```env
# CoinMarketCap API Key (required for price data)
COINMARKETCAP_API_KEY=your_cmc_api_key_here

# Anthropic Claude API Key (required for natural language queries)
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

### Option 2: Environment Variables

Set environment variables directly:

```bash
export COINMARKETCAP_API_KEY=your_cmc_api_key_here
export ANTHROPIC_API_KEY=sk-ant-your_key_here
```

Add these to your shell profile (`.bashrc`, `.zshrc`, etc.) for persistence.

### Option 3: Configuration File

The init script creates a config file at `~/.config/crypto-tracker/config.json`. You can edit this directly, but `.env` is preferred.

### Verify Configuration

```bash
npm run dev env
```

You should see:

```
Environment: dev
  Database path: /path/to/wealth-management/data/dev
  ✓ ANTHROPIC_API_KEY configured
  ✓ COINMARKETCAP_API_KEY configured
```

---

## Database Initialization

Hoard uses two SQLite databases:

- **Ledger DB** (`ledger.db`): Your portfolio data (snapshots, holdings, assets, liabilities)
- **Rates DB** (`rates.db`): Market price data and cache

### Initialize Databases

```bash
# Initialize both dev and prod environments
npm run init

# Or initialize only dev
npm run init:dev

# Or initialize only prod
npm run init:prod
```

The init script will:

1. Create the `data/dev/` and `data/prod/` directories
2. Initialize SQLite databases with the current schema
3. Seed common cryptocurrency assets (BTC, ETH, SOL, etc.)
4. Create the configuration file

### Run Migrations (if needed)

If you're updating from an older version:

```bash
# Check current schema version
npm run dev migrate --status

# Apply pending migrations
npm run dev migrate
```

---

## Quick Start Guide

Now that everything is set up, let's record your first portfolio snapshot.

### 1. Add Your First Snapshot

```bash
npm run dev snapshot add
```

You'll be guided through an interactive prompt:

```
◇  Snapshot date (YYYY-MM-DD):
│  2025-01-22
│
◇  Add a note for this snapshot? (optional)
│  Monthly portfolio review
│
◇  Enter asset symbol (or 'done' to finish):
│  BTC
│
◇  Amount of BTC:
│  0.5
│
◇  Enter asset symbol (or 'done' to finish):
│  ETH
│
◇  Amount of ETH:
│  5
│
◇  Enter asset symbol (or 'done' to finish):
│  done

✓ Snapshot created for 2025-01-22 with 2 holdings
```

### 2. View Your Portfolio

```bash
npm run dev portfolio summary
```

Output:

```
Portfolio Summary (2025-01-22)

Holdings:
  BTC     0.50000000    €22,500.00   45.0%
  ETH     5.00000000    €13,750.00   27.5%

Total Value: €36,250.00
```

### 3. Ask Questions (Natural Language)

```bash
npm run dev query "What's my total portfolio worth?"
```

```bash
npm run dev query "How much Bitcoin do I have?"
```

```bash
npm run dev query "Show me my portfolio breakdown by percentage"
```

### 4. List Your Snapshots

```bash
npm run dev snapshot list
```

```
Snapshots:
  2025-01-22  Monthly portfolio review  (2 holdings)
```

### 5. Set Allocation Targets (Optional)

```bash
npm run dev allocation set
```

Follow the prompts to set your target portfolio allocation, then compare:

```bash
npm run dev allocation compare
```

---

## Next Steps

Now that you have Hoard running, explore these features:

### Import Historical Data

If you have Koinly export files:

```bash
npm run import-koinly
```

See [Koinly Import Guide](./koinly-import.md) for details.

### Learn the CLI Commands

```bash
# Full command reference
npm run dev -- --help

# Specific command help
npm run dev snapshot --help
npm run dev query --help
npm run dev allocation --help
```

### Environment Management

Switch between dev and prod:

```bash
# Dev environment (default)
npm run dev snapshot list

# Production environment
npm run dev -- --env prod snapshot list
```

### Read the Documentation

- [User Guide](./02-user-guide.md) - Complete CLI reference
- [Architecture](./03-architecture.md) - System design
- [Domain Model](./04-domain-model.md) - Data structures
- [Developer Guide](./05-developer-guide.md) - Contributing
- [API Reference](./06-api-reference.md) - Service interfaces
- [Operations](./07-operations.md) - Maintenance & troubleshooting

---

## Troubleshooting

### "Cannot find module" errors

Ensure you're using Node v22.19.0:

```bash
node --version  # Should be v22.19.0
```

### API key not working

Verify your keys are set:

```bash
npm run dev env
```

### Database errors

Re-initialize the databases:

```bash
rm -rf data/dev data/prod
npm run init
```

### More help

See the [Operations Guide](./07-operations.md) for detailed troubleshooting.

---

**Last Updated:** January 2025
