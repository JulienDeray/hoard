import Database from 'better-sqlite3';
import { readFileSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';
import { Logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Migration {
  version: number;
  description: string;
  sql?: string; // SQL file path relative to migrations/ledger/
  run?: (ledgerDb: Database.Database, ratesDb: Database.Database) => Promise<void>; // TypeScript function
}

export interface MigrationResult {
  version: number;
  description: string;
  success: boolean;
  error?: string;
  duration?: number;
}

export interface SchemaVersion {
  version: number;
  description: string;
  applied_at: string;
}

// Registry of all migrations
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    sql: '001_initial.sql',
  },
  {
    version: 2,
    description: 'Allocation targets',
    sql: '002_allocation_targets.sql',
  },
  {
    version: 3,
    description: 'Multi-asset wealth management schema',
    sql: '003_schema_v2.sql',
  },
  {
    version: 4,
    description: 'Remove redundant value_eur columns',
    sql: '004_remove_value_eur.sql',
  },
  {
    version: 5,
    description: 'Remove redundant total columns from snapshots',
    sql: '005_remove_snapshot_totals.sql',
  },
  {
    version: 6,
    description: 'Add snapshot totals cache for fast list queries',
    sql: '006_snapshot_totals_cache.sql',
  },
];

export class MigrationRunner {
  private ledgerDb: Database.Database;
  private ratesDb: Database.Database;
  private ledgerPath: string;

  constructor(ledgerDb: Database.Database, ratesDb: Database.Database, ledgerPath: string) {
    this.ledgerDb = ledgerDb;
    this.ratesDb = ratesDb;
    this.ledgerPath = ledgerPath;
  }

  /**
   * Ensures the schema_version table exists
   */
  private ensureSchemaVersionTable(): void {
    this.ledgerDb.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Gets the current schema version from the database
   * Returns 0 if no migrations have been recorded yet
   */
  getCurrentVersion(): number {
    this.ensureSchemaVersionTable();

    const result = this.ledgerDb
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number | null };

    return result.version ?? 0;
  }

  /**
   * Gets all recorded schema versions
   */
  getAppliedVersions(): SchemaVersion[] {
    this.ensureSchemaVersionTable();

    return this.ledgerDb
      .prepare('SELECT version, description, applied_at FROM schema_version ORDER BY version')
      .all() as SchemaVersion[];
  }

  /**
   * Checks if existing tables exist but no schema_version is recorded
   * This indicates a legacy database that needs to be marked as migrated
   */
  private detectExistingSchema(): number {
    // Check for tables that exist in various schema versions
    const tables = this.ledgerDb
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name IN ('snapshots', 'holdings', 'assets', 'allocation_targets')`
      )
      .all() as { name: string }[];

    const tableNames = new Set(tables.map((t) => t.name));

    // If no tables exist, it's a fresh database
    if (tableNames.size === 0) {
      return 0;
    }

    // If allocation_targets exists, at least v2 has been applied
    if (tableNames.has('allocation_targets')) {
      return 2;
    }

    // If basic tables exist, v1 has been applied
    if (tableNames.has('snapshots') && tableNames.has('holdings') && tableNames.has('assets')) {
      return 1;
    }

    return 0;
  }

  /**
   * Marks existing migrations as applied (for legacy databases)
   */
  private markExistingMigrations(upToVersion: number): void {
    this.ensureSchemaVersionTable();

    const insert = this.ledgerDb.prepare(`
      INSERT OR IGNORE INTO schema_version (version, description, applied_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    for (const migration of MIGRATIONS) {
      if (migration.version <= upToVersion) {
        insert.run(migration.version, migration.description);
      }
    }
  }

  /**
   * Returns migrations that haven't been applied yet
   */
  getPendingMigrations(): Migration[] {
    const currentVersion = this.getCurrentVersion();

    // If schema_version is empty but tables exist, detect and mark existing migrations
    if (currentVersion === 0) {
      const existingVersion = this.detectExistingSchema();
      if (existingVersion > 0) {
        Logger.info(`Detected existing schema at version ${existingVersion}, marking as applied...`);
        this.markExistingMigrations(existingVersion);
        return MIGRATIONS.filter((m) => m.version > existingVersion);
      }
    }

    return MIGRATIONS.filter((m) => m.version > currentVersion);
  }

  /**
   * Creates a backup of the ledger database
   * Returns the backup file path
   */
  createBackup(): string {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const backupPath = `${this.ledgerPath}.backup.${timestamp}`;
    const backupDir = dirname(backupPath);

    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    copyFileSync(this.ledgerPath, backupPath);
    Logger.success(`Backup created: ${backupPath}`);

    return backupPath;
  }

  /**
   * Runs a single migration
   */
  async runMigration(migration: Migration, dryRun: boolean = false): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      if (migration.sql) {
        const sqlPath = join(__dirname, 'ledger', migration.sql);
        const sql = readFileSync(sqlPath, 'utf-8');

        if (dryRun) {
          Logger.info(`[DRY RUN] Would apply SQL from ${migration.sql}`);
          Logger.debug(`SQL content:\n${sql.substring(0, 500)}...`);
        } else {
          this.ledgerDb.exec(sql);
        }
      }

      if (migration.run) {
        if (dryRun) {
          Logger.info(`[DRY RUN] Would run TypeScript migration function`);
        } else {
          await migration.run(this.ledgerDb, this.ratesDb);
        }
      }

      // Record the migration
      if (!dryRun) {
        this.ledgerDb
          .prepare(
            `INSERT INTO schema_version (version, description, applied_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)`
          )
          .run(migration.version, migration.description);
      }

      return {
        version: migration.version,
        description: migration.description,
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        version: migration.version,
        description: migration.description,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Runs all pending migrations
   */
  async runAll(dryRun: boolean = false): Promise<MigrationResult[]> {
    const pending = this.getPendingMigrations();
    const results: MigrationResult[] = [];

    if (pending.length === 0) {
      Logger.info('No pending migrations');
      return results;
    }

    Logger.info(`Found ${pending.length} pending migration(s)`);

    for (const migration of pending) {
      Logger.info(
        `${dryRun ? '[DRY RUN] ' : ''}Running migration v${migration.version}: ${migration.description}`
      );

      const result = await this.runMigration(migration, dryRun);
      results.push(result);

      if (result.success) {
        Logger.success(
          `${dryRun ? '[DRY RUN] ' : ''}Migration v${migration.version} completed in ${result.duration}ms`
        );
      } else {
        Logger.error(`Migration v${migration.version} failed: ${result.error}`);
        // Stop on first failure
        break;
      }
    }

    return results;
  }

  /**
   * Gets status summary for display
   */
  getStatus(): {
    currentVersion: number;
    appliedMigrations: SchemaVersion[];
    pendingMigrations: Migration[];
  } {
    return {
      currentVersion: this.getCurrentVersion(),
      appliedMigrations: this.getAppliedVersions(),
      pendingMigrations: this.getPendingMigrations(),
    };
  }
}
