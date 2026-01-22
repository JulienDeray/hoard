# User Guide

Complete reference for using Hoard's REST API and Web UI.

## Table of Contents

1. [Overview](#overview)
2. [Running the Application](#running-the-application)
3. [REST API Reference](#rest-api-reference)
4. [Web UI](#web-ui)
5. [Common Workflows](#common-workflows)

---

## Overview

Hoard provides two interfaces for managing your portfolio:

1. **REST API** - Fastify-based JSON API running on port 3001
2. **Web UI** - React-based dashboard running on port 5173

Both interfaces interact with the same underlying data.

---

## Running the Application

### Start the API Server

```bash
# Development mode (uses data/dev/ databases)
npm run dev:api:dev

# Production mode (uses data/prod/ databases)
npm run dev:api:prod
```

The API server runs on `http://localhost:3001`.

### Start the Web UI

```bash
npm run dev:web
```

The web UI runs on `http://localhost:5173`.

### Run Both Together

```bash
npm run dev:all
```

---

## REST API Reference

All API endpoints are prefixed with `/api`.

### Health Check

```
GET /api/health
```

Returns `{ "status": "ok" }` if the server is running.

---

### Snapshots

Snapshots capture your portfolio at a point in time.

#### List Snapshots

```
GET /api/snapshots
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `last` | number | Return only the last N snapshots |

**Response:**
```json
{
  "snapshots": [
    {
      "id": 1,
      "date": "2025-01-22",
      "notes": "Monthly review",
      "total_assets_eur": 36250.00,
      "total_liabilities_eur": 285000.00,
      "net_worth_eur": -248750.00,
      "created_at": "2025-01-22T10:30:00Z"
    }
  ],
  "count": 1
}
```

#### Get Previous Snapshot Data

```
GET /api/snapshots/previous
```

Returns the most recent snapshot with all holdings, useful for pre-filling forms.

#### Get Snapshot by Date

```
GET /api/snapshots/:date
```

**Parameters:**
- `date` - Snapshot date in YYYY-MM-DD format

**Response:**
```json
{
  "snapshot": {
    "id": 1,
    "date": "2025-01-22",
    "notes": "Monthly review"
  },
  "holdings": [
    {
      "id": 1,
      "asset_symbol": "BTC",
      "asset_name": "Bitcoin",
      "amount": 0.5,
      "current_price_eur": 45000,
      "current_value_eur": 22500,
      "current_percentage": 62.1
    }
  ],
  "liability_balances": [...],
  "total_assets_eur": 36250.00,
  "total_liabilities_eur": 285000.00,
  "net_worth_eur": -248750.00
}
```

#### Create Snapshot

```
POST /api/snapshots
```

**Body:**
```json
{
  "date": "2025-01-22",
  "notes": "Monthly review"
}
```

#### Delete Snapshot

```
DELETE /api/snapshots/:date
```

---

### Holdings

Holdings are positions within a snapshot.

#### Add Holding to Snapshot

```
POST /api/snapshots/:date/holdings
```

**Body:**
```json
{
  "symbol": "BTC",
  "amount": 0.5,
  "price_eur": 45000
}
```

Note: `price_eur` is optional. If provided, it saves a historical rate for the snapshot date.

#### Update Holding

```
PUT /api/snapshots/:date/holdings/:assetId
```

**Body:**
```json
{
  "amount": 0.6
}
```

#### Delete Holding

```
DELETE /api/snapshots/:date/holdings/:assetId
```

---

### Liability Balances

Track outstanding amounts on liabilities per snapshot.

#### Add Liability Balance

```
POST /api/snapshots/:date/liabilities
```

**Body:**
```json
{
  "liability_id": 1,
  "outstanding_amount": 280000
}
```

#### Update Liability Balance

```
PUT /api/snapshots/:date/liabilities/:liabilityId
```

**Body:**
```json
{
  "outstanding_amount": 275000
}
```

#### Delete Liability Balance

```
DELETE /api/snapshots/:date/liabilities/:liabilityId
```

---

### Assets

Assets are things you can hold (crypto, stocks, fiat, etc.).

#### List Assets

```
GET /api/assets
```

**Response:**
```json
{
  "assets": [
    {
      "id": 1,
      "symbol": "BTC",
      "name": "Bitcoin",
      "asset_class": "CRYPTO",
      "valuation_source": "CMC",
      "is_active": true
    }
  ]
}
```

#### Search Assets

```
GET /api/assets/search?q=bit
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `limit` | number | Max results (default: 10) |

---

### Portfolio

Portfolio analytics and value calculations.

#### Get Portfolio Summary

```
GET /api/portfolio/summary
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | string | Snapshot date (YYYY-MM-DD), defaults to latest |

**Response:**
```json
{
  "date": "2025-01-22",
  "holdings": [
    {
      "asset_symbol": "BTC",
      "asset_name": "Bitcoin",
      "amount": 0.5,
      "current_price_eur": 45000,
      "current_value_eur": 22500,
      "current_percentage": 62.1
    }
  ],
  "total_assets_eur": 36250.00,
  "total_liabilities_eur": 285000.00,
  "net_worth_eur": -248750.00,
  "real_estate": {
    "total_value": 0,
    "total_equity": 0,
    "properties": []
  }
}
```

---

### Allocation Targets

Set and compare portfolio allocation targets.

#### List Targets

```
GET /api/allocations/targets
```

**Response:**
```json
{
  "targets": [
    {
      "id": 1,
      "target_type": "ASSET",
      "target_key": "BTC",
      "target_percentage": 50,
      "tolerance_pct": 2
    }
  ]
}
```

#### Compare Allocation

```
GET /api/allocations/compare
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | string | Snapshot date (YYYY-MM-DD), defaults to latest |

**Response:**
```json
{
  "date": "2025-01-22",
  "total_value": 36250.00,
  "allocations": [
    {
      "target_key": "BTC",
      "display_name": "Bitcoin",
      "current_percentage": 62.1,
      "target_percentage": 50,
      "difference_percentage": 12.1,
      "is_within_tolerance": false
    }
  ],
  "has_targets": true
}
```

#### Set Targets

```
PUT /api/allocations/targets
```

**Body:**
```json
{
  "targets": [
    {
      "target_type": "ASSET",
      "target_key": "BTC",
      "target_percentage": 50,
      "tolerance_pct": 2
    },
    {
      "target_type": "ASSET",
      "target_key": "ETH",
      "target_percentage": 50,
      "tolerance_pct": 2
    }
  ]
}
```

#### Clear Targets

```
DELETE /api/allocations/targets
```

---

### Prices

Get and manage cryptocurrency prices.

#### Get Current Prices

```
GET /api/prices/current?symbols=BTC,ETH
```

**Response:**
```json
{
  "prices": [
    { "symbol": "BTC", "price": 45000, "currency": "EUR" },
    { "symbol": "ETH", "price": 2750, "currency": "EUR" }
  ]
}
```

#### Refresh Prices

```
POST /api/prices/refresh
```

**Body:**
```json
{
  "symbols": ["BTC", "ETH"]
}
```

Forces a fresh fetch from CoinMarketCap, bypassing the cache.

#### Override Price

```
POST /api/prices/override
```

**Body:**
```json
{
  "symbol": "BTC",
  "price": 45000,
  "date": "2025-01-22"
}
```

Manually set a historical price for an asset on a specific date.

---

### Liabilities

Manage loans, mortgages, and other liabilities.

#### List Liabilities

```
GET /api/liabilities
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `active_only` | boolean | Only return active liabilities (default: true) |

#### Get Liability by ID

```
GET /api/liabilities/:id
```

#### Create Liability

```
POST /api/liabilities
```

**Body:**
```json
{
  "name": "House Mortgage",
  "liability_type": "MORTGAGE",
  "original_amount": 300000,
  "interest_rate": 2.5,
  "start_date": "2020-01-15",
  "term_months": 300,
  "linked_asset_id": 5
}
```

**Liability Types:** `LOAN`, `MORTGAGE`, `CREDIT_LINE`

#### Update Liability

```
PUT /api/liabilities/:id
```

#### Delete Liability

```
DELETE /api/liabilities/:id
```

---

### Properties

Manage real estate properties.

#### List Properties

```
GET /api/properties
```

#### Get Property by ID

```
GET /api/properties/:id
```

#### Create Property

```
POST /api/properties
```

**Body:**
```json
{
  "name": "Main Residence",
  "property_type": "PRIMARY_RESIDENCE",
  "current_value": 450000,
  "address": "123 Main St"
}
```

**Property Types:** `PRIMARY_RESIDENCE`, `RENTAL`, `VACATION`

#### Update Property

```
PUT /api/properties/:id
```

#### Update Property Value

```
PUT /api/properties/:id/value
```

**Body:**
```json
{
  "current_value": 475000
}
```

---

## Web UI

The web UI provides a dashboard for managing your portfolio.

### Features

- **Dashboard**: Overview of net worth and allocation
- **Snapshots**: Create and manage monthly snapshots
- **Holdings**: Add, edit, and remove asset holdings
- **Allocation**: Set targets and track drift
- **Properties**: Manage real estate assets
- **Liabilities**: Track loans and mortgages

### Accessing the Web UI

1. Start the API server: `npm run dev:api:dev`
2. Start the web UI: `npm run dev:web`
3. Open `http://localhost:5173` in your browser

---

## Common Workflows

### Monthly Portfolio Review

1. Open the web UI or use the API
2. Create a new snapshot for the current month
3. Enter all your current holdings
4. Enter liability balances
5. Review allocation vs targets
6. Note any rebalancing needed

### API Example: Create Monthly Snapshot

```bash
# Create snapshot
curl -X POST http://localhost:3001/api/snapshots \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-01-22", "notes": "January review"}'

# Add holdings
curl -X POST http://localhost:3001/api/snapshots/2025-01-22/holdings \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTC", "amount": 0.5}'

curl -X POST http://localhost:3001/api/snapshots/2025-01-22/holdings \
  -H "Content-Type: application/json" \
  -d '{"symbol": "ETH", "amount": 5.0}'

# Get portfolio summary
curl http://localhost:3001/api/portfolio/summary?date=2025-01-22
```

### Setting Up Allocation Targets

```bash
curl -X PUT http://localhost:3001/api/allocations/targets \
  -H "Content-Type: application/json" \
  -d '{
    "targets": [
      {"target_type": "ASSET", "target_key": "BTC", "target_percentage": 50, "tolerance_pct": 2},
      {"target_type": "ASSET", "target_key": "ETH", "target_percentage": 50, "tolerance_pct": 2}
    ]
  }'

# Compare current allocation
curl http://localhost:3001/api/allocations/compare
```

---

**Last Updated:** January 2025
