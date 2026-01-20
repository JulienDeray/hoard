# Crypto Tracker

A CLI tool for tracking crypto assets with natural language queries powered by Claude AI.

## Features

- 📊 **Monthly Portfolio Snapshots** - Manually track your crypto holdings over time
- 🤖 **Natural Language Queries** - Ask questions about your portfolio in plain English
- 💰 **Historical Price Data** - Automatic price tracking via CoinMarketCap API
- 📈 **Portfolio Analytics** - View your total portfolio value and asset breakdown
- 🗄️ **Local SQLite Storage** - Your data stays on your machine

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- API Keys:
  - [CoinMarketCap API Key](https://coinmarketcap.com/api/) (free tier available)
  - [Anthropic Claude API Key](https://console.anthropic.com/)

## Installation

1. Clone the repository:
```bash
cd wealth-management
```

2. Install dependencies:
```bash
npm install
```

3. Create your `.env` file:
```bash
cp .env.example .env
```

4. Add your API keys to `.env`:
```env
CMC_API_KEY=your_coinmarketcap_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

5. Initialize the application:
```bash
npm run init
```

## Usage

### Adding a Portfolio Snapshot

Track your monthly crypto holdings:

```bash
npm run dev snapshot add
```

This will guide you through an interactive prompt to:
- Enter the snapshot date
- Add holdings for each crypto asset
- Optionally fetch current prices

### Viewing Snapshots

List all snapshots:
```bash
npm run dev snapshot list
```

View a specific snapshot:
```bash
npm run dev snapshot view 2025-01-01
```

### Natural Language Queries

Ask questions about your portfolio using Claude AI:

```bash
npm run dev query "How much Bitcoin do I have?"
npm run dev query "What is my total portfolio worth in euros?"
npm run dev query "Show me all my holdings"
npm run dev query "What was my portfolio value in December 2024?"
```

### Portfolio Summary

View your current portfolio with live prices:

```bash
npm run dev portfolio summary
```

### Importing Historical Data

Import historical snapshots from Koinly:

```bash
# Preview import without making changes
npm run import-koinly -- --dry-run

# Import all Koinly snapshot files
npm run import-koinly

# Import and overwrite existing snapshots
npm run import-koinly -- --force
```

See [docs/koinly-import.md](docs/koinly-import.md) for detailed import guide, including:
- How to create Koinly snapshot files from clipboard data
- File format specification
- Edge case handling
- Asset enrichment workflow

## Project Structure

```
wealth-management/
├── src/
│   ├── cli/              # CLI commands and interface
│   ├── database/         # Database operations and migrations
│   ├── models/           # TypeScript type definitions
│   ├── services/         # Business logic (CoinMarketCap, Claude, Portfolio)
│   └── utils/            # Utilities (config, logging, validation)
├── scripts/              # Setup and maintenance scripts
├── data/                 # SQLite databases (gitignored)
└── CLAUDE.md             # AI coding assistant instructions

```

## Configuration

Configuration is stored in `~/.crypto-tracker/config.json` and can be initialized with:

```bash
npm run init
```

You can also use environment variables in `.env`:
- `CMC_API_KEY` - CoinMarketCap API key
- `ANTHROPIC_API_KEY` - Anthropic Claude API key

## Database Structure

### Ledger Database (`data/ledger.db`)
- `snapshots` - Monthly portfolio snapshots
- `holdings` - Crypto holdings for each snapshot
- `assets` - Metadata about tracked cryptocurrencies

### Rates Database (`data/rates.db`)
- `historical_rates` - Historical price data
- `rate_cache` - Cached current prices (5-minute TTL)

## Development

Build the project:
```bash
npm run build
```

Run in development mode:
```bash
npm run dev [command]
```

Run tests:
```bash
npm test
```

Format code:
```bash
npm run format
```

Lint code:
```bash
npm run lint
```

## API Rate Limits

The free tier of CoinMarketCap API provides ~333 calls per day. The application:
- Caches current prices for 5 minutes
- Rate limits API requests (1 second between calls)
- Stores historical prices to minimize API usage

## Security

- API keys are stored in `.env` (gitignored)
- Database files are stored locally in `data/` (gitignored)
- No data is transmitted except to CoinMarketCap and Anthropic APIs

## Troubleshooting

**"Configuration not complete" error:**
- Run `npm run init` to set up configuration
- Ensure API keys are set in `.env` or `~/.crypto-tracker/config.json`

**"No data found" when querying:**
- Add a snapshot first with `npm run dev snapshot add`

**CoinMarketCap API errors:**
- Check your API key is valid
- Verify you haven't exceeded rate limits
- Ensure the crypto symbol is correct (e.g., BTC, ETH)

## Web UI

The project includes a React-based web UI in the `web/` directory for visualizing portfolio data.

### Running the Web UI

```bash
# Install dependencies (first time only)
cd web && npm install

# Start development server
cd web && npm run dev
```

Or use the convenience scripts from the root:

```bash
npm run web:dev    # Start dev server
npm run web:build  # Build for production
```

The web UI will be available at http://localhost:5173

### Features

- **Dashboard** - Overview with quick stats and navigation
- **Snapshots** - List and view portfolio snapshots over time
- **Portfolio** - Current holdings breakdown with allocation weights
- **Allocations** - Compare current vs target allocations with rebalancing suggestions

### Tech Stack

- **Build**: Vite + TypeScript
- **UI**: React 19 + React Router 7
- **Components**: shadcn/ui + Tailwind CSS v4
- **State**: TanStack Query

Note: The web UI currently uses mock data. Connect it to a real API backend when available.

## License

MIT
