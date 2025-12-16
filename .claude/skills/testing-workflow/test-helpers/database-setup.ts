import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function setupTestLedgerDb(): Database.Database {
  const db = new Database(':memory:');
  const migrationPath = join(__dirname, '../../src/database/migrations/ledger/001_initial.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  db.exec(migration);
  return db;
}

export function setupTestRatesDb(): Database.Database {
  const db = new Database(':memory:');
  const migrationPath = join(__dirname, '../../src/database/migrations/rates/001_initial.sql');
  const migration = readFileSync(migrationPath, 'utf-8');
  db.exec(migration);
  return db;
}

export function seedTestData(db: Database.Database) {
  // Insert common test data
  db.exec(`
    INSERT INTO snapshots (date, notes) VALUES
      ('2024-01-15', 'January snapshot'),
      ('2024-02-15', 'February snapshot');

    INSERT INTO assets (symbol, name, cmc_id) VALUES
      ('BTC', 'Bitcoin', 1),
      ('ETH', 'Ethereum', 1027),
      ('SOL', 'Solana', 5426);
  `);
}
