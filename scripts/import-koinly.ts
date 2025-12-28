#!/usr/bin/env tsx

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { parse, format } from 'date-fns';
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { DatabaseManager } from '../src/database/connection.js';
import { LedgerRepository } from '../src/database/ledger.js';
import { RatesRepository } from '../src/database/rates.js';
import { configManager } from '../src/utils/config.js';

// ============================================================================
// Types
// ============================================================================

interface KoinlyAsset {
  symbol: string;
  amount: number;
  priceEur: number;
}

interface KoinlySnapshot {
  date: string; // ISO format YYYY-MM-DD
  originalDate: string; // Original "Mon D, YYYY" format
  assets: KoinlyAsset[];
  filePath: string;
}

interface ImportOptions {
  dryRun: boolean;
  force: boolean;
  directory: string;
}

interface FileResult {
  file: string;
  success: boolean;
  snapshot?: { date: string; holdingsCount: number };
  skipped?: boolean;
  error?: string;
}

interface ImportSummary {
  totalFiles: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
  newAssets: Set<string>;
}

interface ParseError {
  line: number;
  symbol?: string;
  message: string;
}

// ============================================================================
// Parser
// ============================================================================

class KoinlyParser {
  parseFile(filePath: string): KoinlySnapshot {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      throw new Error('File is empty');
    }

    // Parse date from first line (e.g., "Oct 1, 2020")
    const originalDate = lines[0];
    const date = this.parseDate(originalDate);

    // Parse assets (groups of 3 lines: symbol, amount, price)
    const assets: KoinlyAsset[] = [];
    const errors: ParseError[] = [];

    for (let i = 1; i < lines.length; i += 3) {
      if (i + 2 >= lines.length) {
        // Not enough lines for a complete asset entry
        if (i + 1 < lines.length) {
          errors.push({
            line: i + 1,
            symbol: lines[i],
            message: `Incomplete asset entry (missing ${3 - (lines.length - i)} line(s))`,
          });
        }
        break;
      }

      const symbol = lines[i].trim();
      const amountStr = lines[i + 1].trim();
      const priceStr = lines[i + 2].trim();

      try {
        const amount = this.parseAmount(amountStr);
        const priceEur = this.parsePrice(priceStr);

        // Validate parsed values
        if (amount <= 0) {
          errors.push({
            line: i + 2,
            symbol,
            message: `Invalid amount: ${amount} (must be positive)`,
          });
          continue;
        }

        if (priceEur <= 0) {
          errors.push({
            line: i + 3,
            symbol,
            message: `Invalid price: ${priceEur} (must be positive)`,
          });
          continue;
        }

        assets.push({ symbol, amount, priceEur });
      } catch (error: any) {
        errors.push({
          line: i + 1,
          symbol,
          message: error.message,
        });
      }
    }

    // Log parsing errors if any
    if (errors.length > 0) {
      console.log(
        pc.yellow(
          `  ⚠️  Skipped ${errors.length} malformed entr${errors.length === 1 ? 'y' : 'ies'} in ${basename(filePath)}:`
        )
      );
      errors.forEach((err) => {
        console.log(pc.cyan(`     Line ${err.line}: ${err.symbol || '?'} - ${err.message}`));
      });
    }

    if (assets.length === 0) {
      throw new Error('No valid assets found in file');
    }

    return {
      date,
      originalDate,
      assets,
      filePath,
    };
  }

  private parseDate(dateStr: string): string {
    try {
      // Parse "Oct 1, 2020" format
      const parsedDate = parse(dateStr, 'MMM d, yyyy', new Date());
      return format(parsedDate, 'yyyy-MM-dd');
    } catch (error) {
      throw new Error(`Failed to parse date "${dateStr}": ${error}`);
    }
  }

  private parseAmount(amountStr: string): number {
    // Remove spaces (thousands separator) and replace comma with dot
    const normalized = amountStr.replace(/\s/g, '').replace(',', '.');
    const amount = parseFloat(normalized);

    if (isNaN(amount)) {
      throw new Error(`Failed to parse amount "${amountStr}"`);
    }

    return amount;
  }

  private parsePrice(priceStr: string): number {
    // Extract number from "306,55 € / unit" format
    const match = priceStr.match(/^([\d\s,]+)\s*€\s*\/\s*unit/i);

    if (!match) {
      throw new Error(`Failed to parse price "${priceStr}" (expected format: "X € / unit")`);
    }

    // Remove spaces and replace comma with dot
    const normalized = match[1].replace(/\s/g, '').replace(',', '.');
    const price = parseFloat(normalized);

    if (isNaN(price)) {
      throw new Error(`Failed to parse price number "${match[1]}"`);
    }

    return price;
  }
}

// ============================================================================
// Importer
// ============================================================================

class KoinlyImporter {
  constructor(
    private ledgerRepo: LedgerRepository,
    private ratesRepo: RatesRepository,
    private parser: KoinlyParser
  ) {}

  async importAll(files: string[], options: ImportOptions): Promise<ImportSummary> {
    const summary: ImportSummary = {
      totalFiles: files.length,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      newAssets: new Set<string>(),
    };

    const spinner = clack.spinner();

    for (const file of files) {
      const fileName = basename(file);
      spinner.start(`Processing ${fileName}...`);

      try {
        const result = this.importSingleFile(file, options);

        if (result.success) {
          if (result.skipped) {
            summary.skipped++;
            spinner.message(pc.yellow(`Skipped ${fileName} (already exists)`));
          } else {
            summary.imported++;
            if (result.snapshot) {
              spinner.message(
                pc.green(
                  `Imported ${fileName}: ${result.snapshot.date} (${result.snapshot.holdingsCount} assets)`
                )
              );
            }
          }
        } else {
          summary.failed++;
          if (result.error) {
            summary.errors.push({ file: fileName, error: result.error });
            spinner.message(pc.red(`Failed ${fileName}: ${result.error}`));
          }
        }
      } catch (error: any) {
        summary.failed++;
        summary.errors.push({ file: fileName, error: error.message });
        spinner.message(pc.red(`Failed ${fileName}: ${error.message}`));
      }
    }

    spinner.stop('Import complete');

    return summary;
  }

  private importSingleFile(filePath: string, options: ImportOptions): FileResult {
    try {
      // Parse file
      const koinlyData = this.parser.parseFile(filePath);

      if (options.dryRun) {
        return {
          file: basename(filePath),
          success: true,
          snapshot: { date: koinlyData.date, holdingsCount: koinlyData.assets.length },
        };
      }

      // Check for duplicate
      const existingSnapshot = this.ledgerRepo.getSnapshotByDate(koinlyData.date);

      if (existingSnapshot) {
        if (!options.force) {
          return {
            file: basename(filePath),
            success: true,
            skipped: true,
          };
        }

        // Delete existing snapshot (CASCADE deletes holdings)
        this.ledgerRepo.deleteSnapshot(existingSnapshot.id);
      }

      // Create snapshot
      const snapshot = this.ledgerRepo.createSnapshot({
        date: koinlyData.date,
        notes: 'Imported from Koinly',
      });

      // Create holdings
      for (const asset of koinlyData.assets) {
        // Ensure asset exists
        this.ensureAssetExists(asset.symbol);

        // Create holding
        this.ledgerRepo.createHolding({
          snapshot_id: snapshot.id,
          asset_symbol: asset.symbol,
          asset_name: asset.symbol, // Will be enriched later
          amount: asset.amount,
          acquisition_price_eur: asset.priceEur,
          acquisition_date: koinlyData.date,
        });
      }

      // Save historical rates
      this.saveHistoricalRates(koinlyData);

      return {
        file: basename(filePath),
        success: true,
        snapshot: { date: koinlyData.date, holdingsCount: koinlyData.assets.length },
      };
    } catch (error: any) {
      return {
        file: basename(filePath),
        success: false,
        error: error.message,
      };
    }
  }

  private ensureAssetExists(symbol: string): void {
    let asset = this.ledgerRepo.getAsset(symbol);

    if (!asset) {
      asset = this.ledgerRepo.createAsset({
        symbol: symbol,
        name: symbol, // Use symbol as placeholder name
      });
      console.log(pc.cyan(`  → Created new asset: ${symbol} (needs CMC enrichment)`));
    }
  }

  private saveHistoricalRates(koinlyData: KoinlySnapshot): void {
    // Use snapshot date at midnight UTC as timestamp
    const timestamp = `${koinlyData.date}T00:00:00.000Z`;

    for (const asset of koinlyData.assets) {
      try {
        this.ratesRepo.saveHistoricalRate({
          asset_symbol: asset.symbol,
          base_currency: 'EUR',
          price: asset.priceEur,
          timestamp: timestamp,
          source: 'koinly',
        });
      } catch (error: any) {
        // Ignore UNIQUE constraint violations (rate already exists)
        if (!error.message.includes('UNIQUE constraint')) {
          console.log(
            pc.yellow(
              `  ⚠️  Failed to save rate for ${asset.symbol} on ${koinlyData.date}: ${error.message}`
            )
          );
        }
      }
    }
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  clack.intro(pc.bold('Import Koinly Snapshots'));

  // Parse command line args
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const directoryArg = args.find((arg) => arg.startsWith('--directory='));
  const customDirectory = directoryArg?.split('=')[1];

  const options: ImportOptions = {
    dryRun,
    force,
    directory: customDirectory || join(process.cwd(), 'data/koinly_snapshots'),
  };

  // Initialize
  try {
    const config = configManager.get();
    const ledgerDb = DatabaseManager.getLedgerDb(config.database.ledgerPath);
    const ratesDb = DatabaseManager.getRatesDb(config.database.ratesPath);
    const ledgerRepo = new LedgerRepository(ledgerDb);
    const ratesRepo = new RatesRepository(ratesDb);
    const parser = new KoinlyParser();
    const importer = new KoinlyImporter(ledgerRepo, ratesRepo, parser);

    // Find files
    const files = readdirSync(options.directory)
      .filter((f) => f.startsWith('koinly-') && f.endsWith('.txt'))
      .map((f) => join(options.directory, f))
      .sort();

    if (files.length === 0) {
      clack.log.error('No Koinly files found');
      console.log(pc.cyan(`Searched in: ${options.directory}`));
      DatabaseManager.closeAll();
      process.exit(1);
    }

    // Display options
    console.log(pc.cyan(`Directory: ${options.directory}`));
    console.log(pc.cyan(`Files found: ${files.length}`));
    console.log(
      pc.cyan(`Mode: ${dryRun ? 'DRY RUN' : force ? 'FORCE (overwrite)' : 'skip existing'}`)
    );
    console.log();

    // Interactive confirmation
    if (!dryRun) {
      const confirm = await clack.confirm({
        message: `Import ${files.length} Koinly snapshot${files.length === 1 ? '' : 's'}?`,
        initialValue: true,
      });

      if (clack.isCancel(confirm) || !confirm) {
        clack.cancel('Import cancelled');
        DatabaseManager.closeAll();
        process.exit(0);
      }
    }

    // Execute import
    const summary = await importer.importAll(files, options);

    // Display summary
    console.log();
    clack.outro(
      pc.bold(
        dryRun
          ? 'Dry run complete'
          : `Import complete: ${summary.imported} imported, ${summary.skipped} skipped, ${summary.failed} failed`
      )
    );

    if (summary.imported > 0 && !dryRun) {
      console.log(pc.green(`\n✓ Successfully imported ${summary.imported} snapshot(s)`));
    }

    if (summary.skipped > 0) {
      console.log(pc.yellow(`⚠️  Skipped ${summary.skipped} existing snapshot(s)`));
      console.log(pc.cyan('   Use --force to overwrite existing snapshots'));
    }

    if (summary.failed > 0) {
      console.log(pc.red(`\n✗ Failed to import ${summary.failed} file(s):`));
      summary.errors.forEach(({ file, error }) => {
        console.log(pc.red(`   ${file}: ${error}`));
      });
    }

    if (summary.newAssets.size > 0 && !dryRun) {
      console.log(pc.yellow(`\n⚠️  New assets created (need CMC enrichment):`));
      Array.from(summary.newAssets).forEach((symbol) => {
        console.log(pc.cyan(`   - ${symbol}`));
      });
      console.log(pc.cyan('\nEnrich assets manually or via snapshot add command'));
    }

    console.log();

    // Cleanup
    DatabaseManager.closeAll();

    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (error: any) {
    clack.log.error('Import failed');
    console.error(error);
    DatabaseManager.closeAll();
    process.exit(1);
  }
}

main().catch((error) => {
  clack.log.error('\n✗ Import failed:');
  console.error(error);
  DatabaseManager.closeAll();
  process.exit(1);
});
