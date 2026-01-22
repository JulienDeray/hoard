# Operations Guide

Database migrations, backups, rate limiting, and troubleshooting.

## Table of Contents

1. [Database Migrations](#database-migrations)
2. [Backup & Recovery](#backup--recovery)
3. [Rate Limiting & Caching](#rate-limiting--caching)
4. [Troubleshooting](#troubleshooting)

---

## Database Migrations

Hoard uses a versioned migration system. Migrations are applied explicitly via CLI commands—there is no automatic migration on startup.

### Check Migration Status

```bash
npm run migrate -- --status
```

**Output:**

```
Schema Version Information:
  Current version: 7

Applied Migrations:
  ✓ v1: Initial schema (2025-12-13)
  ✓ v2: Allocation targets (2025-12-28)
  ✓ v3: Multi-asset schema (2026-01-05)
  ✓ v4: Remove value_eur (2026-01-10)
  ✓ v5: Remove snapshot totals (2026-01-12)
  ✓ v6: Snapshot totals cache (2026-01-15)
  ✓ v7: Asset metadata (2026-01-20)

Pending Migrations:
  (none)
```

### Run Migrations

**Preview first (recommended):**

```bash
npm run migrate -- --dry-run
```

**Apply migrations:**

```bash
npm run migrate
```

The script will:
1. Show pending migrations
2. Request confirmation
3. Create a backup
4. Apply each migration
5. Offer to run backfill operations

### Production Migrations

```bash
# Always preview first
npm run migrate -- --env=prod --dry-run

# Then apply
npm run migrate -- --env=prod
```

### Run Backfill Operations

Backfill operations populate computed values after schema changes:

```bash
npm run migrate -- --backfill
```

Current backfill operations:
- Clear and recalculate snapshot totals cache

---

## Backup & Recovery

### Automatic Backups

The migration system automatically creates a backup before applying migrations.

**Backup location:** `{database_path}.backup.{YYYYMMdd_HHmmss}`

Example:
```
data/dev/ledger.db.backup.20260122_143052
```

### Manual Backups

```bash
# Backup dev environment
cp data/dev/ledger.db data/dev/ledger.db.backup.manual
cp data/dev/rates.db data/dev/rates.db.backup.manual

# Backup prod environment
cp data/prod/ledger.db data/prod/ledger.db.backup.manual
```

### Recovery from Backup

```bash
# Stop any running processes first

# Restore from backup
cp data/dev/ledger.db.backup.20260122_143052 data/dev/ledger.db

# Verify restoration
npm run dev migrate --status
```

### Backup Retention

Clean up old backups periodically:

```bash
# List backups
ls -lh data/dev/ledger.db.backup.*

# Remove backups older than 30 days (macOS/Linux)
find data/dev -name "ledger.db.backup.*" -mtime +30 -delete
```

---

## Rate Limiting & Caching

### CoinMarketCap Rate Limiting

**Approach:** Request queue with 1-second delay between calls.

```
Request 1 → Process
            Wait 1 second
Request 2 → Process
            Wait 1 second
Request 3 → Process
...
```

**Effective limits:**
- Free tier: ~333 calls/day (exact limit varies)
- Hoard: Conservative 1 call/second
- Recommended: 200-300 calls/day maximum

### Price Cache (5-Minute TTL)

The rates database maintains two price storage mechanisms:

**1. rate_cache table** — Current prices with TTL

```sql
SELECT * FROM rate_cache WHERE asset_symbol = 'BTC';
```

Expired entries are removed on read.

**2. historical_rates table** — Complete price history

```sql
SELECT * FROM historical_rates
WHERE asset_symbol = 'BTC'
ORDER BY timestamp DESC
LIMIT 10;
```

### Cache Behavior

```
Price Request
     │
     ▼
┌────────────────────┐
│ Check rate_cache   │
│ (5-minute TTL)     │
│                    │
│ Found & valid?     │
│ └─ Yes → Return    │
└────────┬───────────┘
         │ No
         ▼
┌────────────────────┐
│ Check historical   │
│ (most recent)      │
│                    │
│ Found?             │
│ └─ Yes → Return    │
└────────┬───────────┘
         │ No
         ▼
┌────────────────────┐
│ Fetch from CMC     │
│ (rate-limited)     │
│                    │
│ Update cache       │
│ Save to historical │
│ Return             │
└────────────────────┘
```

### Clearing the Cache

Force a refresh of all prices:

```bash
# Via SQL
sqlite3 data/dev/rates.db "DELETE FROM rate_cache;"

# Then use the API to trigger refresh
curl -X POST http://localhost:3001/api/prices/refresh \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["BTC", "ETH"]}'
```

---

## Troubleshooting

### Import Errors with .js Extensions

**Error:**
```
Cannot find module './config.js'
```

**Cause:** TypeScript with ESM requires `.js` extensions.

**Solution:** Add `.js` to import paths:

```typescript
// Correct
import { configManager } from '../utils/config.js';

// Wrong
import { configManager } from '../utils/config';
```

---

### Database Locked Errors

**Error:**
```
Error: database is locked
```

**Cause:** Multiple processes or unclosed connections.

**Solutions:**

1. **Check for running processes:**
   ```bash
   pgrep -f "node" | xargs ps -o pid,cmd -p
   ```

2. **Kill stuck processes:**
   ```bash
   pkill -f "node"
   ```

3. **Wait and retry:**
   SQLite locks are usually released within seconds.

4. **Remove lock files (last resort):**
   ```bash
   rm -f data/dev/ledger.db-journal
   rm -f data/dev/rates.db-journal
   ```

---

### CoinMarketCap API 401 (Unauthorized)

**Error:**
```
CoinMarketCap API error: Invalid API key
```

**Cause:** Missing or invalid API key.

**Solution:**

1. Check configuration in `.env`:
   ```bash
   cat .env | grep CMC_API_KEY
   ```

2. Set API key in `.env`:
   ```bash
   echo "CMC_API_KEY=your_key" >> .env
   ```

3. Get a free key from [coinmarketcap.com/api](https://coinmarketcap.com/api/)

---

### Invalid Date Format Errors

**Error:**
```
Invalid date format: 2025/01/22. Use YYYY-MM-DD
```

**Solution:** Use ISO 8601 format (YYYY-MM-DD):
- Correct: `2025-01-22`
- Wrong: `2025/01/22`, `January 22, 2025`

---

### Schema Version Mismatch

**Error:**
```
Database schema version 5 is behind expected version 7.
Run 'npm run migrate' to update the schema.
```

**Solution:**

```bash
npm run migrate -- --status    # Check status
npm run migrate -- --dry-run   # Preview
npm run migrate                # Apply
```

---

### Migration Failure

**Error:**
```
Migration v7 failed: UNIQUE constraint failed
```

**Solution:**

1. **Restore from backup:**
   ```bash
   cp data/dev/ledger.db.backup.20260122_143052 data/dev/ledger.db
   ```

2. **Check the migration:**
   ```bash
   cat src/database/migrations/ledger/007_add_asset_metadata.sql
   ```

3. **Preview again:**
   ```bash
   npm run dev migrate --dry-run
   ```

---

### No Portfolio Data Found

**Error:**
```
No portfolio data found for 2025-01-22
```

**Cause:** No snapshot exists for that date.

**Solution:**
1. Check existing snapshots via `GET /api/snapshots`
2. Create a new snapshot via `POST /api/snapshots`
3. Or use the Web UI to manage snapshots

---

### Diagnostic Commands

**Check database integrity:**

```bash
sqlite3 data/dev/ledger.db "PRAGMA integrity_check;"
```

**View schema version:**

```bash
sqlite3 data/dev/ledger.db "SELECT * FROM schema_version;"
```

**Count records:**

```bash
sqlite3 data/dev/ledger.db "
  SELECT 'snapshots', COUNT(*) FROM snapshots
  UNION ALL SELECT 'holdings', COUNT(*) FROM holdings
  UNION ALL SELECT 'assets', COUNT(*) FROM assets;
"
```

**Check cache age:**

```bash
sqlite3 data/dev/rates.db "
  SELECT asset_symbol,
    ROUND((julianday('now') - julianday(last_updated)) * 1440, 1) AS age_minutes
  FROM rate_cache
  ORDER BY age_minutes DESC;
"
```

**Vacuum database (reclaim space):**

```bash
sqlite3 data/dev/ledger.db "VACUUM;"
sqlite3 data/dev/rates.db "VACUUM;"
```

---

### Performance Tips

1. **Index queries:** Ensure indexes exist on frequently queried columns.

2. **Vacuum periodically:** After many deletes, run VACUUM to reclaim space.

3. **Monitor cache hit rate:** Check if prices are being fetched repeatedly.

4. **Limit API calls:** Use `--dry-run` for migrations to avoid unnecessary price fetches.

---

## Summary

| Task | Command |
|------|---------|
| Check migration status | `npm run migrate -- --status` |
| Preview migrations | `npm run migrate -- --dry-run` |
| Apply migrations | `npm run migrate` |
| Run backfill | `npm run migrate -- --backfill` |
| Start API server (dev) | `npm run dev:api:dev` |
| Start API server (prod) | `npm run dev:api:prod` |
| Start Web UI | `npm run dev:web` |
| Clear price cache | `sqlite3 data/dev/rates.db "DELETE FROM rate_cache;"` |
| Restore backup | `cp backup_file ledger.db` |

---

**Last Updated:** January 2025
