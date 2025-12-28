import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DatabaseManager {
  private static ledgerDbInstance: Database.Database | null = null;
  private static ratesDbInstance: Database.Database | null = null;

  static getLedgerDb(path: string): Database.Database {
    if (!this.ledgerDbInstance) {
      this.ledgerDbInstance = new Database(path);
      this.ledgerDbInstance.pragma('foreign_keys = ON');
      this.runLedgerMigrations(this.ledgerDbInstance);
    }
    return this.ledgerDbInstance;
  }

  static getRatesDb(path: string): Database.Database {
    if (!this.ratesDbInstance) {
      this.ratesDbInstance = new Database(path);
      this.runRatesMigrations(this.ratesDbInstance);
    }
    return this.ratesDbInstance;
  }

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

  static closeLedgerDb(): void {
    if (this.ledgerDbInstance) {
      this.ledgerDbInstance.close();
      this.ledgerDbInstance = null;
    }
  }

  static closeRatesDb(): void {
    if (this.ratesDbInstance) {
      this.ratesDbInstance.close();
      this.ratesDbInstance = null;
    }
  }

  static closeAll(): void {
    this.closeLedgerDb();
    this.closeRatesDb();
  }
}
