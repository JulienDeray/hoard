import type Database from 'better-sqlite3';
import type {
  Snapshot,
  CreateSnapshotInput,
  Holding,
  CreateHoldingInput,
  Asset,
  CreateAssetInput,
  AllocationTarget,
  CreateAllocationTargetInput,
  UpdateAllocationTargetInput,
} from '../models/index.js';

export class LedgerRepository {
  constructor(private db: Database.Database) {}

  // Snapshot operations
  createSnapshot(input: CreateSnapshotInput): Snapshot {
    const stmt = this.db.prepare(`
      INSERT INTO snapshots (date, notes)
      VALUES (?, ?)
    `);

    const result = stmt.run(input.date, input.notes || null);

    return this.getSnapshotById(Number(result.lastInsertRowid))!;
  }

  getSnapshotById(id: number): Snapshot | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots WHERE id = ?
    `);

    return stmt.get(id) as Snapshot | undefined;
  }

  getSnapshotByDate(date: string): Snapshot | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots WHERE date = ?
    `);

    return stmt.get(date) as Snapshot | undefined;
  }

  getLatestSnapshot(): Snapshot | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots ORDER BY date DESC LIMIT 1
    `);

    return stmt.get() as Snapshot | undefined;
  }

  listSnapshots(): Snapshot[] {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots ORDER BY date DESC
    `);

    return stmt.all() as Snapshot[];
  }

  deleteSnapshot(id: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM snapshots WHERE id = ?
    `);

    stmt.run(id);
  }

  // Holding operations
  createHolding(input: CreateHoldingInput): Holding {
    const stmt = this.db.prepare(`
      INSERT INTO holdings (
        snapshot_id, asset_symbol, asset_name, amount,
        acquisition_date, acquisition_price_eur, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.snapshot_id,
      input.asset_symbol,
      input.asset_name,
      input.amount,
      input.acquisition_date || null,
      input.acquisition_price_eur || null,
      input.notes || null
    );

    return this.getHoldingById(Number(result.lastInsertRowid))!;
  }

  getHoldingById(id: number): Holding | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM holdings WHERE id = ?
    `);

    return stmt.get(id) as Holding | undefined;
  }

  getHoldingsBySnapshotId(snapshotId: number): Holding[] {
    const stmt = this.db.prepare(`
      SELECT * FROM holdings WHERE snapshot_id = ?
    `);

    return stmt.all(snapshotId) as Holding[];
  }

  getHoldingsByDate(date: string): Holding[] {
    const stmt = this.db.prepare(`
      SELECT h.* FROM holdings h
      JOIN snapshots s ON h.snapshot_id = s.id
      WHERE s.date = ?
    `);

    return stmt.all(date) as Holding[];
  }

  getLatestHoldings(): Holding[] {
    const latestSnapshot = this.getLatestSnapshot();
    if (!latestSnapshot) return [];

    return this.getHoldingsBySnapshotId(latestSnapshot.id);
  }

  updateHolding(id: number, updates: Partial<Omit<Holding, 'id' | 'snapshot_id'>>): void {
    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');

    const values = Object.values(updates);
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE holdings SET ${fields} WHERE id = ?
    `);

    stmt.run(...values);
  }

  deleteHolding(id: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM holdings WHERE id = ?
    `);

    stmt.run(id);
  }

  // Asset operations
  createAsset(input: CreateAssetInput): Asset {
    const stmt = this.db.prepare(`
      INSERT INTO assets (symbol, name, cmc_id, last_updated, is_active)
      VALUES (?, ?, ?, datetime('now'), 1)
    `);

    stmt.run(input.symbol, input.name, input.cmc_id || null);

    return this.getAsset(input.symbol)!;
  }

  getAsset(symbol: string): Asset | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM assets WHERE symbol = ?
    `);

    const result = stmt.get(symbol) as any;
    if (!result) return undefined;

    return {
      ...result,
      is_active: result.is_active === 1,
    };
  }

  listAssets(activeOnly = true): Asset[] {
    const query = activeOnly
      ? 'SELECT * FROM assets WHERE is_active = 1 ORDER BY symbol'
      : 'SELECT * FROM assets ORDER BY symbol';

    const stmt = this.db.prepare(query);
    const results = stmt.all() as any[];

    return results.map((r) => ({
      ...r,
      is_active: r.is_active === 1,
    }));
  }

  updateAsset(symbol: string, updates: Partial<Omit<Asset, 'symbol'>>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.cmc_id !== undefined) {
      fields.push('cmc_id = ?');
      values.push(updates.cmc_id);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }

    fields.push('last_updated = datetime("now")');
    values.push(symbol);

    const stmt = this.db.prepare(`
      UPDATE assets SET ${fields.join(', ')} WHERE symbol = ?
    `);

    stmt.run(...values);
  }

  deleteAsset(symbol: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM assets WHERE symbol = ?
    `);

    stmt.run(symbol);
  }

  // Utility methods
  getSnapshotWithHoldings(date: string): { snapshot: Snapshot; holdings: Holding[] } | null {
    const snapshot = this.getSnapshotByDate(date);
    if (!snapshot) return null;

    const holdings = this.getHoldingsBySnapshotId(snapshot.id);

    return { snapshot, holdings };
  }

  // Allocation Target operations
  createAllocationTarget(input: CreateAllocationTargetInput): AllocationTarget {
    const stmt = this.db.prepare(`
      INSERT INTO allocation_targets (asset_symbol, target_percentage, notes)
      VALUES (?, ?, ?)
    `);

    stmt.run(input.asset_symbol, input.target_percentage, input.notes || null);

    return this.getAllocationTarget(input.asset_symbol)!;
  }

  getAllocationTarget(symbol: string): AllocationTarget | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM allocation_targets WHERE asset_symbol = ?
    `);

    return stmt.get(symbol) as AllocationTarget | undefined;
  }

  listAllocationTargets(): AllocationTarget[] {
    const stmt = this.db.prepare(`
      SELECT * FROM allocation_targets ORDER BY target_percentage DESC
    `);

    return stmt.all() as AllocationTarget[];
  }

  updateAllocationTarget(symbol: string, updates: UpdateAllocationTargetInput): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.target_percentage !== undefined) {
      fields.push('target_percentage = ?');
      values.push(updates.target_percentage);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    if (fields.length === 0) return;

    values.push(symbol);

    const stmt = this.db.prepare(`
      UPDATE allocation_targets SET ${fields.join(', ')} WHERE asset_symbol = ?
    `);

    stmt.run(...values);
  }

  deleteAllocationTarget(symbol: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM allocation_targets WHERE asset_symbol = ?
    `);

    stmt.run(symbol);
  }

  setAllocationTargets(targets: CreateAllocationTargetInput[]): void {
    const transaction = this.db.transaction(() => {
      // Clear existing targets
      this.db.prepare('DELETE FROM allocation_targets').run();

      // Insert new targets
      const insert = this.db.prepare(`
        INSERT INTO allocation_targets (asset_symbol, target_percentage, notes)
        VALUES (?, ?, ?)
      `);

      for (const target of targets) {
        insert.run(target.asset_symbol, target.target_percentage, target.notes || null);
      }
    });

    transaction();
  }

  validateAllocationTargets(): { valid: boolean; sum: number; errors: string[] } {
    const targets = this.listAllocationTargets();
    const sum = targets.reduce((acc, t) => acc + t.target_percentage, 0);
    const errors: string[] = [];

    if (Math.abs(sum - 100) > 0.01) {
      errors.push(`Allocation targets sum to ${sum.toFixed(2)}%, must equal 100%`);
    }

    return { valid: errors.length === 0, sum, errors };
  }
}
