import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MigrationRunner } from '../../src/database/migrations/runner.js';
import {
  backfillHoldingValues,
  backfillSnapshotTotals,
} from '../../src/database/migrations/backfill.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fake path for in-memory databases (backup won't work but that's ok for tests)
const FAKE_DB_PATH = '/tmp/test-ledger.db';

function setupEmptyDb(): Database.Database {
  return new Database(':memory:');
}

function setupV1Db(): Database.Database {
  const db = new Database(':memory:');
  const migrationPath = join(__dirname, '../../src/database/migrations/ledger/001_initial.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  db.exec(migration);
  return db;
}

function setupV2Db(): Database.Database {
  const db = setupV1Db();
  const migrationPath = join(__dirname, '../../src/database/migrations/ledger/002_allocation_targets.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  db.exec(migration);
  return db;
}

function setupRatesDb(): Database.Database {
  const db = new Database(':memory:');
  const migrationPath = join(__dirname, '../../src/database/migrations/rates/001_initial.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  db.exec(migration);
  return db;
}

describe('MigrationRunner', () => {
  let ledgerDb: Database.Database;
  let ratesDb: Database.Database;
  let runner: MigrationRunner;

  afterEach(() => {
    ledgerDb?.close();
    ratesDb?.close();
  });

  describe('getCurrentVersion', () => {
    it('should return 0 for empty database', () => {
      ledgerDb = setupEmptyDb();
      ratesDb = setupRatesDb();
      runner = new MigrationRunner(ledgerDb, ratesDb, FAKE_DB_PATH);

      expect(runner.getCurrentVersion()).toBe(0);
    });

    it('should detect v1 schema via getPendingMigrations', () => {
      // The detection of existing schema happens in getPendingMigrations
      // which marks detected versions in schema_version table
      ledgerDb = setupV1Db();
      ratesDb = setupRatesDb();
      runner = new MigrationRunner(ledgerDb, ratesDb, FAKE_DB_PATH);

      // Call getPendingMigrations to trigger detection
      runner.getPendingMigrations();
      const version = runner.getCurrentVersion();
      expect(version).toBe(1);
    });

    it('should detect v2 schema via getPendingMigrations', () => {
      ledgerDb = setupV2Db();
      ratesDb = setupRatesDb();
      runner = new MigrationRunner(ledgerDb, ratesDb, FAKE_DB_PATH);

      // Call getPendingMigrations to trigger detection
      runner.getPendingMigrations();
      const version = runner.getCurrentVersion();
      expect(version).toBe(2);
    });

    it('should read from schema_version table if exists', () => {
      ledgerDb = setupV2Db();
      ratesDb = setupRatesDb();

      // Create schema_version table manually
      ledgerDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
        INSERT INTO schema_version VALUES (3, 'test version', datetime('now'));
      `);

      runner = new MigrationRunner(ledgerDb, ratesDb, FAKE_DB_PATH);
      expect(runner.getCurrentVersion()).toBe(3);
    });
  });

  describe('getPendingMigrations', () => {
    it('should return all migrations for empty database', () => {
      ledgerDb = setupEmptyDb();
      ratesDb = setupRatesDb();
      runner = new MigrationRunner(ledgerDb, ratesDb, FAKE_DB_PATH);

      const pending = runner.getPendingMigrations();
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].version).toBe(1);
    });

    it('should return no migrations for up-to-date database', () => {
      ledgerDb = setupV2Db();
      ratesDb = setupRatesDb();

      // Mark as latest version
      ledgerDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
        INSERT INTO schema_version VALUES (1, 'v1', datetime('now'));
        INSERT INTO schema_version VALUES (2, 'v2', datetime('now'));
        INSERT INTO schema_version VALUES (3, 'v3', datetime('now'));
      `);

      runner = new MigrationRunner(ledgerDb, ratesDb, FAKE_DB_PATH);
      const pending = runner.getPendingMigrations();
      expect(pending.length).toBe(0);
    });

    it('should return only migrations after current version', () => {
      ledgerDb = setupV2Db();
      ratesDb = setupRatesDb();
      runner = new MigrationRunner(ledgerDb, ratesDb, FAKE_DB_PATH);

      const pending = runner.getPendingMigrations();
      expect(pending.every((m) => m.version > 2)).toBe(true);
    });
  });

  describe('runMigration', () => {
    it('should run a migration successfully', async () => {
      ledgerDb = setupV2Db();
      ratesDb = setupRatesDb();
      runner = new MigrationRunner(ledgerDb, ratesDb, FAKE_DB_PATH);

      const pending = runner.getPendingMigrations();
      if (pending.length > 0) {
        const result = await runner.runMigration(pending[0], false);
        expect(result.success).toBe(true);
        expect(result.version).toBe(pending[0].version);
      }
    });

    it('should not modify database in dry run mode', async () => {
      ledgerDb = setupV2Db();
      ratesDb = setupRatesDb();

      // Manually mark v1 and v2 as applied so we know the starting version
      ledgerDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
        INSERT INTO schema_version VALUES (1, 'v1', datetime('now'));
        INSERT INTO schema_version VALUES (2, 'v2', datetime('now'));
      `);

      runner = new MigrationRunner(ledgerDb, ratesDb, FAKE_DB_PATH);
      const versionBefore = runner.getCurrentVersion();
      expect(versionBefore).toBe(2);

      const pending = runner.getPendingMigrations();
      expect(pending.length).toBeGreaterThan(0);

      await runner.runMigration(pending[0], true);
      expect(runner.getCurrentVersion()).toBe(versionBefore);
    });
  });
});

describe('Backfill Functions', () => {
  let ledgerDb: Database.Database;
  let ratesDb: Database.Database;

  beforeEach(() => {
    // Set up v3 schema for backfill testing
    ledgerDb = new Database(':memory:');
    ratesDb = setupRatesDb();

    // Create v3 schema directly for testing backfill
    ledgerDb.exec(`
      CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        asset_class TEXT NOT NULL DEFAULT 'CRYPTO',
        valuation_source TEXT NOT NULL DEFAULT 'CMC',
        external_id TEXT,
        currency TEXT NOT NULL DEFAULT 'EUR',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        notes TEXT,
        total_assets_eur REAL,
        total_liabilities_eur REAL DEFAULT 0,
        net_worth_eur REAL
      );

      CREATE TABLE holdings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        asset_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        value_eur REAL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id),
        FOREIGN KEY (asset_id) REFERENCES assets(id)
      );

      CREATE TABLE liabilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        liability_type TEXT NOT NULL DEFAULT 'LOAN',
        linked_asset_id INTEGER,
        original_amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        interest_rate REAL,
        start_date TEXT,
        term_months INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (linked_asset_id) REFERENCES assets(id)
      );

      CREATE TABLE liability_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        liability_id INTEGER NOT NULL,
        outstanding_amount REAL NOT NULL,
        value_eur REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id),
        FOREIGN KEY (liability_id) REFERENCES liabilities(id)
      );
    `);
  });

  afterEach(() => {
    ledgerDb?.close();
    ratesDb?.close();
  });

  describe('backfillHoldingValues', () => {
    it('should skip holdings that already have value_eur', async () => {
      // Arrange
      ledgerDb.exec(`
        INSERT INTO assets (symbol, name) VALUES ('BTC', 'Bitcoin');
        INSERT INTO snapshots (date) VALUES ('2024-01-15');
        INSERT INTO holdings (snapshot_id, asset_id, amount, value_eur)
        VALUES (1, 1, 0.5, 20000);
      `);

      // Act
      const result = await backfillHoldingValues(ledgerDb, ratesDb);

      // Assert - holdings with value_eur are not processed
      expect(result.processed).toBe(0);
      expect(result.updated).toBe(0);
    });

    it('should update holdings with historical rates', async () => {
      // Arrange
      ledgerDb.exec(`
        INSERT INTO assets (symbol, name) VALUES ('BTC', 'Bitcoin');
        INSERT INTO snapshots (date) VALUES ('2024-01-15');
        INSERT INTO holdings (snapshot_id, asset_id, amount)
        VALUES (1, 1, 0.5);
      `);

      ratesDb.exec(`
        INSERT INTO historical_rates (asset_symbol, base_currency, price, timestamp)
        VALUES ('BTC', 'EUR', 40000, '2024-01-15T00:00:00.000Z');
      `);

      // Act
      const result = await backfillHoldingValues(ledgerDb, ratesDb);

      // Assert
      expect(result.processed).toBe(1);
      expect(result.updated).toBe(1);

      const holding = ledgerDb
        .prepare('SELECT value_eur FROM holdings WHERE id = 1')
        .get() as { value_eur: number };
      expect(holding.value_eur).toBe(20000); // 0.5 * 40000
    });

    it('should skip holdings with missing rates', async () => {
      // Arrange
      ledgerDb.exec(`
        INSERT INTO assets (symbol, name) VALUES ('UNKNOWN', 'Unknown Asset');
        INSERT INTO snapshots (date) VALUES ('2024-01-15');
        INSERT INTO holdings (snapshot_id, asset_id, amount)
        VALUES (1, 1, 100);
      `);

      // Act
      const result = await backfillHoldingValues(ledgerDb, ratesDb);

      // Assert - missing rates are tracked in skipped count
      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.updated).toBe(0);
    });
  });

  describe('backfillSnapshotTotals', () => {
    it('should calculate snapshot totals from holdings', async () => {
      // Arrange
      ledgerDb.exec(`
        INSERT INTO assets (symbol, name) VALUES ('BTC', 'Bitcoin'), ('ETH', 'Ethereum');
        INSERT INTO snapshots (date) VALUES ('2024-01-15');
        INSERT INTO holdings (snapshot_id, asset_id, amount, value_eur)
        VALUES (1, 1, 0.5, 20000), (1, 2, 10, 25000);
      `);

      // Act
      const result = await backfillSnapshotTotals(ledgerDb);

      // Assert
      expect(result.updated).toBe(1);

      const snapshot = ledgerDb
        .prepare('SELECT total_assets_eur, net_worth_eur FROM snapshots WHERE id = 1')
        .get() as { total_assets_eur: number; net_worth_eur: number };
      expect(snapshot.total_assets_eur).toBe(45000);
      expect(snapshot.net_worth_eur).toBe(45000);
    });

    it('should handle snapshots with no holdings', async () => {
      // Arrange
      ledgerDb.exec(`
        INSERT INTO snapshots (date) VALUES ('2024-01-15');
      `);

      // Act
      const result = await backfillSnapshotTotals(ledgerDb);

      // Assert
      expect(result.updated).toBe(1);

      const snapshot = ledgerDb
        .prepare('SELECT total_assets_eur, net_worth_eur FROM snapshots WHERE id = 1')
        .get() as { total_assets_eur: number; net_worth_eur: number };
      expect(snapshot.total_assets_eur).toBe(0);
      expect(snapshot.net_worth_eur).toBe(0);
    });

    it('should skip snapshots that already have totals', async () => {
      // Arrange
      ledgerDb.exec(`
        INSERT INTO assets (symbol, name) VALUES ('BTC', 'Bitcoin');
        INSERT INTO snapshots (date, total_assets_eur, net_worth_eur) VALUES ('2024-01-15', 50000, 50000);
        INSERT INTO holdings (snapshot_id, asset_id, amount, value_eur)
        VALUES (1, 1, 0.5, 20000);
      `);

      // Act
      const result = await backfillSnapshotTotals(ledgerDb);

      // Assert - no snapshots need backfill since total_assets_eur is already set
      expect(result.processed).toBe(0);
      expect(result.updated).toBe(0);

      // Value should remain unchanged
      const snapshot = ledgerDb
        .prepare('SELECT total_assets_eur FROM snapshots WHERE id = 1')
        .get() as { total_assets_eur: number };
      expect(snapshot.total_assets_eur).toBe(50000);
    });
  });
});
