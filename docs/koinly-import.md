# Koinly Import Guide

This guide explains how to import historical cryptocurrency portfolio snapshots from Koinly into the Crypto Tracker database.

## Overview

The Koinly import process consists of two steps:

1. **Create snapshot file**: Convert Koinly portfolio data from clipboard to a standardized text file
2. **Import to database**: Parse text files and import snapshots, holdings, and historical rates

## Data Flow

```
Koinly Website
    ↓ (copy portfolio to clipboard)
User's Clipboard
    ↓ (paste into terminal & run shell script)
scripts/koinly_import.zsh
    ↓ (creates formatted file)
data/koinly_snapshots/koinly-YYYY-MM.txt
    ↓ (TypeScript import script)
scripts/import-koinly.ts
    ↓ (parses and imports)
┌─────────────────┬──────────────────┐
│   ledger.db     │    rates.db      │
│  - snapshots    │  - historical_   │
│  - holdings     │    rates         │
│  - assets       │                  │
└─────────────────┴──────────────────┘
```

## Step 1: Create Snapshot File

### Purpose
The `koinly_import.zsh` shell script formats Koinly portfolio data from your clipboard into a standardized text file format that can be imported into the database.

### Usage

1. **Copy portfolio data from Koinly**:
   - Navigate to your Koinly portfolio for a specific month
   - Copy the holdings data to your clipboard

2. **Run the shell script**:
   ```bash
   # Paste clipboard content and pipe to script
   pbpaste | ./scripts/koinly_import.zsh

   # Or redirect from a file
   cat raw_koinly_data.txt | ./scripts/koinly_import.zsh
   ```

3. **Output**:
   - Creates file: `koinly-YYYY-MM.txt` in current directory
   - Move file to `data/koinly_snapshots/` directory

### How the Shell Script Works

The script uses AWK to parse Koinly clipboard data:

```zsh
#!/bin/zsh

output=$(awk '
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]+, [0-9]{4}$/ { print }
  /^[A-Z]{3,5}$/ {
    ticker = $0
    getline; amount = $0
    getline  # skip first value
    getline  # skip first € / unit
    getline  # skip second value
    getline  # this is the second € / unit
    print ticker
    print amount
    print $0
  }
')

date_line=$(echo "$output" | head -1)
month=$(echo "$date_line" | awk '{print $1}')
year=$(echo "$date_line" | awk '{print $3}')

month_num=$(printf "%02d" $(echo "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec" | tr ' ' '\n' | grep -n "^$month$" | cut -d: -f1))

filename="koinly-${year}-${month_num}.txt"

echo "$output"
echo "$output" > "$filename"

echo "\n→ Saved to $filename"
```

**What it does:**
1. Extracts date line (format: "Mon D, YYYY")
2. Extracts ticker symbols (3-5 uppercase letters)
3. For each ticker, reads amount and price
4. Generates filename based on date: `koinly-YYYY-MM.txt`
5. Saves formatted output to file

## Step 2: Import to Database

### Quick Start

```bash
# Preview import without making changes
npm run import-koinly -- --dry-run

# Import all files (skip existing snapshots)
npm run import-koinly

# Import all files (overwrite existing snapshots)
npm run import-koinly -- --force

# Import from custom directory
npm run import-koinly -- --directory=path/to/snapshots
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Preview import without writing to database | false |
| `--force` | Overwrite existing snapshots | false (skip existing) |
| `--directory=<path>` | Custom directory to scan for files | `data/koinly_snapshots` |

### File Format Specification

**Filename**: `koinly-YYYY-MM.txt`

**Content structure**:
```
Mon D, YYYY
SYMBOL
amount
price € / unit
SYMBOL
amount
price € / unit
...
```

**Example** (`koinly-2024-12.txt`):
```
Dec 1, 2024
SOL
250,6902
224,86 € / unit
BTC
0,5586
91 182,52 € / unit
ETH
4,6318
3 504,10 € / unit
```

**Format details**:
- **Date line**: First line, format "Mon D, YYYY" (e.g., "Dec 1, 2024")
- **Asset groups**: Repeating sets of 3 lines per asset:
  1. **Symbol**: Cryptocurrency ticker (e.g., "BTC", "ETH", "SOL")
  2. **Amount**: Quantity held, European decimal format (comma as decimal separator)
  3. **Price**: Format "X € / unit" with European decimal format

**Number formatting**:
- Decimal separator: `,` (comma)
- Thousands separator: ` ` (space) or none
- Examples:
  - `0,5586` = 0.5586
  - `122 939,3366` = 122939.3366
  - `91 182,52 € / unit` = 91182.52 EUR per unit

### Import Behavior

#### New Snapshots
- Creates snapshot with date from filename
- Sets notes to "Imported from Koinly"
- Creates holdings for all assets in file
- Saves historical rates with source='koinly'

#### Existing Snapshots
**Default mode (skip)**:
- Skips file if snapshot already exists for that date
- Displays warning in output
- Use `--force` to override

**Force mode (`--force`)**:
- Deletes existing snapshot (CASCADE deletes holdings)
- Creates new snapshot with Koinly data
- Replaces all holdings for that date

#### Missing Assets
- Automatically creates asset entry if symbol not in database
- Uses symbol as placeholder name (e.g., "BORG" → name: "BORG")
- Sets `cmc_id` to null (needs manual enrichment)
- Lists newly created assets in summary output

#### Historical Rates
- Saves to `rates.db` with source='koinly'
- Timestamp: snapshot date at midnight UTC (YYYY-MM-DDT00:00:00.000Z)
- Base currency: EUR
- Handles UNIQUE constraint gracefully (skips if rate already exists)

### Error Handling

#### Malformed Entries
**Strategy**: Skip malformed entries, continue parsing

**Common issues**:
- Incomplete asset groups (missing price line)
- Invalid amount format (non-numeric)
- Invalid price format (doesn't match "X € / unit")
- Duplicate symbols in same file
- Negative amounts or prices

**Example** (`koinly-2022-06.txt`):
```
Jun 1, 2022
BORG
122 939,3366
0,27 € / unit
EURT        ← Duplicate symbol
EURT        ← Missing price line
32 586      ← Orphaned amount
BTC
0,6149
29 658,11 € / unit
```

**Output**:
```
⚠️  Skipped 1 malformed entry in koinly-2022-06.txt:
   Line 6: EURT - Incomplete asset entry (missing 2 line(s))
```

The script will:
1. Parse BORG successfully
2. Detect malformed EURT entry, skip it
3. Parse BTC successfully
4. Import snapshot with 2 assets (BORG, BTC)

#### File-Level Errors
- Empty files → Error, skip file
- Invalid date format → Error, skip file
- No valid assets → Error, skip file
- File read errors → Error, skip file

**Behavior**: Log error, continue with next file (don't abort entire import)

### Import Summary

After import completes, the script displays:

```
Import complete: 60 imported, 0 skipped, 0 failed

✓ Successfully imported 60 snapshot(s)

⚠️  New assets created (need CMC enrichment):
   - BORG
   - SOLID
   - XBG
   - SHDW
   - HONEY
   - CRETA
   - ALEPH

Enrich assets manually or via snapshot add command
```

**Summary includes**:
- Total files processed
- Successfully imported count
- Skipped count (duplicates)
- Failed count (errors)
- List of new assets without CoinMarketCap IDs

## Asset Enrichment

Assets imported from Koinly are created with:
- **symbol**: From file (e.g., "BORG")
- **name**: Same as symbol (placeholder)
- **cmc_id**: null (not linked to CoinMarketCap)

### Manual Enrichment

Use the interactive snapshot add command to enrich assets:

```bash
npm run dev snapshot add
```

When you add a snapshot with an existing asset that lacks CMC data:
1. Script detects missing CMC ID
2. Offers to search CoinMarketCap by symbol
3. Displays asset info for confirmation
4. Updates asset with CMC ID and proper name

### Batch Enrichment

For multiple assets, consider:
1. Using CoinMarketCap API to look up symbols
2. Directly updating `assets` table in SQLite:
   ```sql
   UPDATE assets
   SET name = 'Swissborg', cmc_id = 8303
   WHERE symbol = 'BORG';
   ```

## Troubleshooting

### No files found

**Error**: `No Koinly files found`

**Solutions**:
- Check directory exists: `ls data/koinly_snapshots/`
- Verify filename pattern: `koinly-YYYY-MM.txt`
- Use `--directory=path` to specify custom location

### Date parsing errors

**Error**: `Failed to parse date "..."`

**Solutions**:
- Ensure first line matches format: "Mon D, YYYY"
- Valid months: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
- Example: "Dec 1, 2024" not "December 1, 2024"

### Amount parsing errors

**Error**: `Failed to parse amount "..."`

**Solutions**:
- Use European decimal format: comma for decimals
- Remove currency symbols from amounts
- Examples:
  - ✓ `0,5586`
  - ✓ `122 939,3366`
  - ✗ `0.5586` (dot instead of comma)
  - ✗ `€122,939.34` (currency symbol, wrong format)

### Price parsing errors

**Error**: `Failed to parse price "..." (expected format: "X € / unit")`

**Solutions**:
- Ensure format: `<number> € / unit`
- Use European decimal format for number
- Examples:
  - ✓ `91 182,52 € / unit`
  - ✓ `0,27 € / unit`
  - ✗ `91182.52 EUR/unit` (wrong format)
  - ✗ `€ 0.27 per unit` (wrong format)

### Database locked errors

**Error**: `database is locked`

**Solutions**:
- Close any other applications accessing the database
- Ensure no other CLI commands are running
- Check for orphaned database connections

### Duplicate snapshot errors

**Default behavior**: Skip with warning

**Override**: Use `--force` to overwrite existing snapshots

```bash
npm run import-koinly -- --force
```

**Warning**: `--force` deletes all existing holdings for that date. Use with caution.

## Advanced Usage

### Selective Import

Import specific date ranges by moving files:

```bash
# Create temporary directory for 2024 files only
mkdir temp_import
cp data/koinly_snapshots/koinly-2024-*.txt temp_import/

# Import only 2024 snapshots
npm run import-koinly -- --directory=temp_import
```

### Dry Run Preview

Always preview before importing:

```bash
npm run import-koinly -- --dry-run
```

Output shows what would be imported without writing to database.

### Re-import with Corrections

If you need to re-import after fixing source files:

```bash
# Fix malformed entries in files
# Then force re-import
npm run import-koinly -- --force
```

This replaces all existing snapshots with corrected data.

## Data Verification

After import, verify data:

### Check snapshot count
```bash
npm run dev snapshot list
```

### View specific snapshot
```bash
npm run dev snapshot view 2024-12-01
```

### Query historical data
```bash
npm run dev query "What was my portfolio worth in December 2024?"
```

### Inspect database directly
```bash
sqlite3 data/ledger.db "SELECT date, COUNT(*) as holdings FROM snapshots JOIN holdings ON snapshots.id = holdings.snapshot_id GROUP BY date ORDER BY date;"
```

### Check historical rates
```bash
sqlite3 data/rates.db "SELECT asset_symbol, price, timestamp FROM historical_rates WHERE source='koinly' ORDER BY timestamp LIMIT 10;"
```

## Best Practices

1. **Always use --dry-run first**: Preview before importing to catch issues

2. **Backup databases**: Before force import, backup your databases:
   ```bash
   cp data/ledger.db data/ledger.db.backup
   cp data/rates.db data/rates.db.backup
   ```

3. **Validate source files**: Check for malformed entries before import

4. **Enrich assets promptly**: Update new assets with CMC data for better querying

5. **Verify after import**: Spot-check a few snapshots to ensure accuracy

6. **Keep source files**: Don't delete `koinly-*.txt` files after import (useful for re-import)

## File Organization

Recommended directory structure:

```
wealth-management/
├── data/
│   ├── koinly_snapshots/
│   │   ├── koinly-2020-10.txt
│   │   ├── koinly-2020-11.txt
│   │   ├── ...
│   │   └── koinly-2025-12.txt
│   ├── ledger.db
│   └── rates.db
├── scripts/
│   ├── koinly_import.zsh    # Step 1: Create files
│   └── import-koinly.ts     # Step 2: Import to DB
└── docs/
    └── koinly-import.md     # This guide
```

## Migration from Manual Entry

If you previously entered snapshots manually:

1. **Backup first**: `cp data/ledger.db data/ledger.db.backup`

2. **Compare data**: Check one snapshot:
   ```bash
   # Manual entry
   npm run dev snapshot view 2024-12-01

   # Koinly data
   cat data/koinly_snapshots/koinly-2024-12.txt
   ```

3. **Decide strategy**:
   - Keep manual: Don't import that date
   - Replace with Koinly: Use `--force`
   - Merge: Manually combine data (not automated)

4. **Selective import**: Only import dates without manual entries

## Support

If you encounter issues not covered in this guide:

1. Check the Koinly file format matches the specification
2. Verify your database is initialized: `npm run init`
3. Review error messages carefully (include line numbers and symbols)
4. Check the GitHub issues for similar problems

## Summary

The Koinly import workflow provides a robust way to populate your crypto portfolio history:

1. **Create files**: `koinly_import.zsh` formats Koinly data
2. **Import database**: `import-koinly.ts` parses and stores data
3. **Enrich assets**: Add CMC metadata for better queries
4. **Verify**: Check snapshots and historical rates

With historical data imported, you can query your portfolio across time:
- "What was my BTC holding in January 2021?"
- "How has my portfolio value changed since 2020?"
- "What was the price of ETH on my purchase date?"
