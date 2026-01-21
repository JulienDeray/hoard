import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MigrationRunner } from '../../src/database/migrations/runner.js';

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

      // Mark as latest version (v6)
      ledgerDb.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
        INSERT INTO schema_version VALUES (1, 'v1', datetime('now'));
        INSERT INTO schema_version VALUES (2, 'v2', datetime('now'));
        INSERT INTO schema_version VALUES (3, 'v3', datetime('now'));
        INSERT INTO schema_version VALUES (4, 'v4', datetime('now'));
        INSERT INTO schema_version VALUES (5, 'v5', datetime('now'));
        INSERT INTO schema_version VALUES (6, 'v6', datetime('now'));
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
