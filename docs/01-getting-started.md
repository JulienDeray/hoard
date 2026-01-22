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

### Build the Project

```bash
npm run build
```

---

## API Key Setup

Hoard integrates with the CoinMarketCap API for cryptocurrency price data.

### CoinMarketCap API (Cryptocurrency Prices)

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

---

## Environment Configuration

### Using .env File (Recommended)

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit with your API key
nano .env  # or use your preferred editor
```

Contents of `.env`:

```env
# CoinMarketCap API Key (required for price data)
CMC_API_KEY=your_cmc_api_key_here
```

### Environment Variables

Set environment variables directly:

```bash
export CMC_API_KEY=your_cmc_api_key_here
```

Add these to your shell profile (`.bashrc`, `.zshrc`, etc.) for persistence.

---

## Database Initialization

Hoard uses two SQLite databases:

- **Ledger DB** (`ledger.db`): Your portfolio data (snapshots, holdings, assets, liabilities)
- **Rates DB** (`rates.db`): Market price data and cache

### Run Migrations

```bash
# Run migrations for development environment
npm run migrate

# Run migrations for production environment
npm run migrate -- --env=prod

# Preview changes before applying
npm run migrate -- --dry-run

# Check current schema version
npm run migrate -- --status
```

The migration script will:

1. Create the `data/dev/` or `data/prod/` directories as needed
2. Initialize SQLite databases with the current schema
3. Apply any pending migrations

---

## Quick Start Guide

Now that everything is set up, let's start the application.

### 1. Start the API Server

```bash
# Development mode (uses data/dev/ databases)
npm run dev:api:dev

# Production mode (uses data/prod/ databases)
npm run dev:api:prod
```

The API server will start on `http://localhost:3001` by default.

### 2. Start the Web UI

In a new terminal:

```bash
npm run dev:web
```

The web UI will start on `http://localhost:5173` (or another port if 5173 is in use).

### 3. Or Run Both Together

```bash
npm run dev:all
```

This starts both the API server and web UI concurrently.

### 4. Using the API

Once the server is running, you can interact with the REST API:

**List snapshots:**
```bash
curl http://localhost:3001/snapshots
```

**Get portfolio value:**
```bash
curl http://localhost:3001/portfolio/value
```

**Create a snapshot:**
```bash
curl -X POST http://localhost:3001/snapshots \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-01-22", "notes": "Monthly review"}'
```

**Add a holding to a snapshot:**
```bash
curl -X POST http://localhost:3001/snapshots/2025-01-22/holdings \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTC", "amount": 0.5}'
```

See the [User Guide](./02-user-guide.md) for the complete API reference.

---

## Next Steps

Now that you have Hoard running, explore these features:

### Use the Web UI

Open `http://localhost:5173` in your browser to:
- View your portfolio dashboard
- Add and manage snapshots
- Track allocation vs targets
- View historical performance

### Learn the API Endpoints

See the [User Guide](./02-user-guide.md) for:
- Complete REST API reference
- All available endpoints
- Request/response examples

### Environment Management

Switch between dev and prod by setting `HOARD_ENV`:

```bash
# Development (default)
HOARD_ENV=dev npm run dev:api

# Production
HOARD_ENV=prod npm run dev:api
```

### Read the Documentation

- [User Guide](./02-user-guide.md) - Complete API reference
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

Verify your key is set in `.env`:

```bash
cat .env | grep CMC_API_KEY
```

### Database errors

Re-initialize the databases:

```bash
rm -rf data/dev data/prod
npm run migrate
```

### More help

See the [Operations Guide](./07-operations.md) for detailed troubleshooting.

---

**Last Updated:** January 2025
