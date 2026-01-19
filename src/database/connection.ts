import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Expected schema version after migration
const EXPECTED_SCHEMA_VERSION = 3;

export class DatabaseManager {
  private static ledgerDbInstance: Database.Database | null = null;
  private static ratesDbInstance: Database.Database | null = null;
  private static currentLedgerPath: string | null = null;
  private static currentRatesPath: string | null = null;

  /**
   * Gets the ledger database connection.
   * Note: Auto-migration has been removed. Use `npm run dev migrate` to apply migrations.
   */
  static getLedgerDb(path: string): Database.Database {
    // If path changed, close old instance
    if (this.ledgerDbInstance && this.currentLedgerPath !== path) {
      this.closeLedgerDb();
    }

    if (!this.ledgerDbInstance) {
      this.currentLedgerPath = path;
      this.ledgerDbInstance = new Database(path);
      this.ledgerDbInstance.pragma('foreign_keys = ON');
      // Note: Migration is no longer automatic - use migrate command
    }
    return this.ledgerDbInstance;
  }

  /**
   * Gets the rates database connection.
   * Note: Auto-migration has been removed. Use `npm run dev migrate` to apply migrations.
   */
  static getRatesDb(path: string): Database.Database {
    // If path changed, close old instance
    if (this.ratesDbInstance && this.currentRatesPath !== path) {
      this.closeRatesDb();
    }

    if (!this.ratesDbInstance) {
      this.currentRatesPath = path;
      this.ratesDbInstance = new Database(path);
      this.runRatesMigrations(this.ratesDbInstance);
    }
    return this.ratesDbInstance;
  }

  /**
   * Gets the ledger database with auto-migration for legacy compatibility.
   * Used during migration process or for fresh database initialization.
   */
  static getLedgerDbWithMigration(path: string): Database.Database {
    if (this.ledgerDbInstance && this.currentLedgerPath !== path) {
      this.closeLedgerDb();
    }

    if (!this.ledgerDbInstance) {
      this.currentLedgerPath = path;
      this.ledgerDbInstance = new Database(path);
      this.ledgerDbInstance.pragma('foreign_keys = ON');
      this.runLedgerMigrations(this.ledgerDbInstance);
    }
    return this.ledgerDbInstance;
  }

  /**
   * Runs legacy migrations (v1 and v2) for fresh database initialization.
   * For v3+, use the migrate command.
   */
  private static runLedgerMigrations(db: Database.Database): void {
    const migrations = ['001_initial.sql', '002_allocation_targets.sql'];

    for (const file of migrations) {
      const migrationPath = join(__dirname, 'migrations', 'ledger', file);
      const sql = readFileSync(migrationPath, 'utf-8');
      db.exec(sql);
    }
  }

  private static runRatesMigrations(db: Database.Database): void {
    const migrationPath = join(__dirname, 'migrations', 'rates', '001_initial.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    db.exec(migration);
  }

  /**
   * Checks if the database schema version matches the expected version.
   * Throws an error if version mismatch is detected.
   */
  static ensureSchemaVersion(db: Database.Database, expectedVersion: number = EXPECTED_SCHEMA_VERSION): void {
    // Check if schema_version table exists
    const tableExists = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name='schema_version'`
      )
      .get();

    if (!tableExists) {
      // No schema_version table means either fresh DB or pre-v3 schema
      return;
    }

    const result = db
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number | null };

    const currentVersion = result.version ?? 0;

    if (currentVersion < expectedVersion) {
      throw new Error(
        `Database schema version ${currentVersion} is behind expected version ${expectedVersion}. ` +
          `Run 'npm run dev migrate' to update the schema.`
      );
    }
  }

  /**
   * Gets the current schema version from the database.
   * Returns 0 if schema_version table doesn't exist.
   */
  static getSchemaVersion(db: Database.Database): number {
    const tableExists = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name='schema_version'`
      )
      .get();

    if (!tableExists) {
      return 0;
    }

    const result = db
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number | null };

    return result.version ?? 0;
  }

  static closeLedgerDb(): void {
    if (this.ledgerDbInstance) {
      this.ledgerDbInstance.close();
      this.ledgerDbInstance = null;
      this.currentLedgerPath = null;
    }
  }

  static closeRatesDb(): void {
    if (this.ratesDbInstance) {
      this.ratesDbInstance.close();
      this.ratesDbInstance = null;
      this.currentRatesPath = null;
    }
  }

  static closeAll(): void {
    this.closeLedgerDb();
    this.closeRatesDb();
  }
}
