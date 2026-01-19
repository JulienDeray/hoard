import type Database from 'better-sqlite3';
import type {
  Snapshot,
  CreateSnapshotInput,
  UpdateSnapshotInput,
  Holding,
  CreateHoldingInput,
  UpdateHoldingInput,
  HoldingWithAsset,
  Asset,
  CreateAssetInput,
  UpdateAssetInput,
  AllocationTarget,
  CreateAllocationTargetInput,
  UpdateAllocationTargetInput,
  Liability,
  CreateLiabilityInput,
  UpdateLiabilityInput,
  LiabilityBalance,
  CreateLiabilityBalanceInput,
  UpdateLiabilityBalanceInput,
  LiabilityBalanceWithDetails,
  LegacyCreateHoldingInput,
  LegacyCreateAssetInput,
  LegacyCreateAllocationTargetInput,
} from '../models/index.js';

export class LedgerRepository {
  constructor(private db: Database.Database) {}

  // ============================================================================
  // Snapshot operations
  // ============================================================================

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

  updateSnapshot(id: number, updates: UpdateSnapshotInput): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.total_assets_eur !== undefined) {
      fields.push('total_assets_eur = ?');
      values.push(updates.total_assets_eur);
    }
    if (updates.total_liabilities_eur !== undefined) {
      fields.push('total_liabilities_eur = ?');
      values.push(updates.total_liabilities_eur);
    }
    if (updates.net_worth_eur !== undefined) {
      fields.push('net_worth_eur = ?');
      values.push(updates.net_worth_eur);
    }

    if (fields.length === 0) return;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE snapshots SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  updateSnapshotTotals(id: number, totals: { total_assets_eur: number; total_liabilities_eur: number; net_worth_eur: number }): void {
    const stmt = this.db.prepare(`
      UPDATE snapshots
      SET total_assets_eur = ?,
          total_liabilities_eur = ?,
          net_worth_eur = ?
      WHERE id = ?
    `);

    stmt.run(totals.total_assets_eur, totals.total_liabilities_eur, totals.net_worth_eur, id);
  }

  deleteSnapshot(id: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM snapshots WHERE id = ?
    `);

    stmt.run(id);
  }

  // ============================================================================
  // Holding operations (new schema with asset_id)
  // ============================================================================

  createHolding(input: CreateHoldingInput): Holding {
    const stmt = this.db.prepare(`
      INSERT INTO holdings (snapshot_id, asset_id, amount, value_eur, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.snapshot_id,
      input.asset_id,
      input.amount,
      input.value_eur || null,
      input.notes || null
    );

    return this.getHoldingById(Number(result.lastInsertRowid))!;
  }

  /**
   * Legacy holding creation - looks up asset by symbol
   */
  createHoldingLegacy(input: LegacyCreateHoldingInput): Holding | null {
    const asset = this.getAssetBySymbol(input.asset_symbol);
    if (!asset) {
      // Auto-create asset if it doesn't exist
      const newAsset = this.createAsset({
        symbol: input.asset_symbol,
        name: input.asset_name,
      });
      return this.createHolding({
        snapshot_id: input.snapshot_id,
        asset_id: newAsset.id,
        amount: input.amount,
        notes: input.notes,
      });
    }

    return this.createHolding({
      snapshot_id: input.snapshot_id,
      asset_id: asset.id,
      amount: input.amount,
      notes: input.notes,
    });
  }

  getHoldingById(id: number): Holding | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM holdings WHERE id = ?
    `);

    return stmt.get(id) as Holding | undefined;
  }

  /**
   * Gets holdings by snapshot ID with asset information (JOINed)
   */
  getHoldingsBySnapshotId(snapshotId: number): HoldingWithAsset[] {
    const stmt = this.db.prepare(`
      SELECT
        h.id, h.snapshot_id, h.asset_id, h.amount, h.value_eur, h.notes,
        h.created_at, h.updated_at,
        a.symbol as asset_symbol, a.name as asset_name, a.asset_class
      FROM holdings h
      JOIN assets a ON h.asset_id = a.id
      WHERE h.snapshot_id = ?
    `);

    return stmt.all(snapshotId) as HoldingWithAsset[];
  }

  /**
   * Gets holdings by date with asset information (JOINed)
   */
  getHoldingsByDate(date: string): HoldingWithAsset[] {
    const stmt = this.db.prepare(`
      SELECT
        h.id, h.snapshot_id, h.asset_id, h.amount, h.value_eur, h.notes,
        h.created_at, h.updated_at,
        a.symbol as asset_symbol, a.name as asset_name, a.asset_class
      FROM holdings h
      JOIN snapshots s ON h.snapshot_id = s.id
      JOIN assets a ON h.asset_id = a.id
      WHERE s.date = ?
    `);

    return stmt.all(date) as HoldingWithAsset[];
  }

  getLatestHoldings(): HoldingWithAsset[] {
    const latestSnapshot = this.getLatestSnapshot();
    if (!latestSnapshot) return [];

    return this.getHoldingsBySnapshotId(latestSnapshot.id);
  }

  updateHolding(id: number, updates: UpdateHoldingInput): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.amount !== undefined) {
      fields.push('amount = ?');
      values.push(updates.amount);
    }
    if (updates.value_eur !== undefined) {
      fields.push('value_eur = ?');
      values.push(updates.value_eur);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    if (fields.length === 0) return;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE holdings SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  updateHoldingValue(id: number, value_eur: number): void {
    const stmt = this.db.prepare(`
      UPDATE holdings SET value_eur = ? WHERE id = ?
    `);

    stmt.run(value_eur, id);
  }

  deleteHolding(id: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM holdings WHERE id = ?
    `);

    stmt.run(id);
  }

  // ============================================================================
  // Asset operations (new schema with id PK)
  // ============================================================================

  createAsset(input: CreateAssetInput): Asset {
    const stmt = this.db.prepare(`
      INSERT INTO assets (symbol, name, asset_class, valuation_source, external_id, currency)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.symbol,
      input.name,
      input.asset_class || 'CRYPTO',
      input.valuation_source || 'CMC',
      input.external_id || null,
      input.currency || 'EUR'
    );

    return this.getAssetById(Number(result.lastInsertRowid))!;
  }

  /**
   * Legacy asset creation with cmc_id
   */
  createAssetLegacy(input: LegacyCreateAssetInput): Asset {
    return this.createAsset({
      symbol: input.symbol,
      name: input.name,
      external_id: input.cmc_id?.toString(),
      asset_class: 'CRYPTO',
      valuation_source: 'CMC',
    });
  }

  getAssetById(id: number): Asset | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM assets WHERE id = ?
    `);

    const result = stmt.get(id) as any;
    if (!result) return undefined;

    return {
      ...result,
      is_active: result.is_active === 1,
    };
  }

  getAssetBySymbol(symbol: string): Asset | undefined {
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

  /**
   * @deprecated Use getAssetBySymbol instead
   */
  getAsset(symbol: string): Asset | undefined {
    return this.getAssetBySymbol(symbol);
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

  listAssetsByClass(assetClass: string, activeOnly = true): Asset[] {
    const query = activeOnly
      ? 'SELECT * FROM assets WHERE asset_class = ? AND is_active = 1 ORDER BY symbol'
      : 'SELECT * FROM assets WHERE asset_class = ? ORDER BY symbol';

    const stmt = this.db.prepare(query);
    const results = stmt.all(assetClass) as any[];

    return results.map((r) => ({
      ...r,
      is_active: r.is_active === 1,
    }));
  }

  updateAsset(id: number, updates: UpdateAssetInput): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.asset_class !== undefined) {
      fields.push('asset_class = ?');
      values.push(updates.asset_class);
    }
    if (updates.valuation_source !== undefined) {
      fields.push('valuation_source = ?');
      values.push(updates.valuation_source);
    }
    if (updates.external_id !== undefined) {
      fields.push('external_id = ?');
      values.push(updates.external_id);
    }
    if (updates.currency !== undefined) {
      fields.push('currency = ?');
      values.push(updates.currency);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }

    if (fields.length === 0) return;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE assets SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  /**
   * @deprecated Use updateAsset with id instead
   */
  updateAssetBySymbol(symbol: string, updates: Partial<Omit<Asset, 'symbol' | 'id'>>): void {
    const asset = this.getAssetBySymbol(symbol);
    if (!asset) return;

    this.updateAsset(asset.id, updates as UpdateAssetInput);
  }

  deleteAsset(id: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM assets WHERE id = ?
    `);

    stmt.run(id);
  }

  // ============================================================================
  // Utility methods
  // ============================================================================

  getSnapshotWithHoldings(date: string): { snapshot: Snapshot; holdings: HoldingWithAsset[] } | null {
    const snapshot = this.getSnapshotByDate(date);
    if (!snapshot) return null;

    const holdings = this.getHoldingsBySnapshotId(snapshot.id);

    return { snapshot, holdings };
  }

  // ============================================================================
  // Allocation Target operations (new schema with target_type)
  // ============================================================================

  createAllocationTarget(input: CreateAllocationTargetInput): AllocationTarget {
    const stmt = this.db.prepare(`
      INSERT INTO allocation_targets (target_type, target_key, target_percentage, tolerance_pct, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.target_type || 'ASSET',
      input.target_key,
      input.target_percentage,
      input.tolerance_pct ?? 2.0,
      input.notes || null
    );

    return this.getAllocationTargetById(Number(result.lastInsertRowid))!;
  }

  /**
   * Legacy allocation target creation with asset_symbol
   */
  createAllocationTargetLegacy(input: LegacyCreateAllocationTargetInput): AllocationTarget {
    return this.createAllocationTarget({
      target_type: 'ASSET',
      target_key: input.asset_symbol,
      target_percentage: input.target_percentage,
      notes: input.notes,
    });
  }

  getAllocationTargetById(id: number): AllocationTarget | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM allocation_targets WHERE id = ?
    `);

    return stmt.get(id) as AllocationTarget | undefined;
  }

  getAllocationTarget(targetKey: string, targetType: string = 'ASSET'): AllocationTarget | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM allocation_targets WHERE target_type = ? AND target_key = ?
    `);

    return stmt.get(targetType, targetKey) as AllocationTarget | undefined;
  }

  listAllocationTargets(targetType?: string): AllocationTarget[] {
    let query = 'SELECT * FROM allocation_targets';
    const params: any[] = [];

    if (targetType) {
      query += ' WHERE target_type = ?';
      params.push(targetType);
    }

    query += ' ORDER BY target_percentage DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as AllocationTarget[];
  }

  updateAllocationTarget(id: number, updates: UpdateAllocationTargetInput): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.target_percentage !== undefined) {
      fields.push('target_percentage = ?');
      values.push(updates.target_percentage);
    }
    if (updates.tolerance_pct !== undefined) {
      fields.push('tolerance_pct = ?');
      values.push(updates.tolerance_pct);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    if (fields.length === 0) return;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE allocation_targets SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  deleteAllocationTarget(id: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM allocation_targets WHERE id = ?
    `);

    stmt.run(id);
  }

  setAllocationTargets(targets: CreateAllocationTargetInput[]): void {
    const transaction = this.db.transaction(() => {
      // Clear existing targets
      this.db.prepare('DELETE FROM allocation_targets').run();

      // Insert new targets
      const insert = this.db.prepare(`
        INSERT INTO allocation_targets (target_type, target_key, target_percentage, tolerance_pct, notes)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const target of targets) {
        insert.run(
          target.target_type || 'ASSET',
          target.target_key,
          target.target_percentage,
          target.tolerance_pct ?? 2.0,
          target.notes || null
        );
      }
    });

    transaction();
  }

  validateAllocationTargets(targetType?: string): { valid: boolean; sum: number; errors: string[] } {
    const targets = this.listAllocationTargets(targetType);
    const sum = targets.reduce((acc, t) => acc + t.target_percentage, 0);
    const errors: string[] = [];

    if (Math.abs(sum - 100) > 0.01) {
      errors.push(`Allocation targets sum to ${sum.toFixed(2)}%, must equal 100%`);
    }

    return { valid: errors.length === 0, sum, errors };
  }

  // ============================================================================
  // Liability operations
  // ============================================================================

  createLiability(input: CreateLiabilityInput): Liability {
    const stmt = this.db.prepare(`
      INSERT INTO liabilities (
        name, liability_type, linked_asset_id, original_amount,
        currency, interest_rate, start_date, term_months, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.name,
      input.liability_type,
      input.linked_asset_id || null,
      input.original_amount,
      input.currency || 'EUR',
      input.interest_rate || null,
      input.start_date || null,
      input.term_months || null,
      input.notes || null
    );

    return this.getLiabilityById(Number(result.lastInsertRowid))!;
  }

  getLiabilityById(id: number): Liability | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM liabilities WHERE id = ?
    `);

    const result = stmt.get(id) as any;
    if (!result) return undefined;

    return {
      ...result,
      is_active: result.is_active === 1,
    };
  }

  listLiabilities(activeOnly = true): Liability[] {
    const query = activeOnly
      ? 'SELECT * FROM liabilities WHERE is_active = 1 ORDER BY name'
      : 'SELECT * FROM liabilities ORDER BY name';

    const stmt = this.db.prepare(query);
    const results = stmt.all() as any[];

    return results.map((r) => ({
      ...r,
      is_active: r.is_active === 1,
    }));
  }

  updateLiability(id: number, updates: UpdateLiabilityInput): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.liability_type !== undefined) {
      fields.push('liability_type = ?');
      values.push(updates.liability_type);
    }
    if (updates.linked_asset_id !== undefined) {
      fields.push('linked_asset_id = ?');
      values.push(updates.linked_asset_id);
    }
    if (updates.interest_rate !== undefined) {
      fields.push('interest_rate = ?');
      values.push(updates.interest_rate);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    if (fields.length === 0) return;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE liabilities SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  deleteLiability(id: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM liabilities WHERE id = ?
    `);

    stmt.run(id);
  }

  // ============================================================================
  // Liability Balance operations
  // ============================================================================

  createLiabilityBalance(input: CreateLiabilityBalanceInput): LiabilityBalance {
    const stmt = this.db.prepare(`
      INSERT INTO liability_balances (snapshot_id, liability_id, outstanding_amount, value_eur)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.snapshot_id,
      input.liability_id,
      input.outstanding_amount,
      input.value_eur || null
    );

    return this.getLiabilityBalanceById(Number(result.lastInsertRowid))!;
  }

  getLiabilityBalanceById(id: number): LiabilityBalance | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM liability_balances WHERE id = ?
    `);

    return stmt.get(id) as LiabilityBalance | undefined;
  }

  getLiabilityBalancesBySnapshotId(snapshotId: number): LiabilityBalanceWithDetails[] {
    const stmt = this.db.prepare(`
      SELECT
        lb.id, lb.snapshot_id, lb.liability_id, lb.outstanding_amount, lb.value_eur,
        lb.created_at, lb.updated_at,
        l.name as liability_name, l.liability_type, l.original_amount,
        l.currency, l.interest_rate
      FROM liability_balances lb
      JOIN liabilities l ON lb.liability_id = l.id
      WHERE lb.snapshot_id = ?
    `);

    return stmt.all(snapshotId) as LiabilityBalanceWithDetails[];
  }

  updateLiabilityBalance(id: number, updates: UpdateLiabilityBalanceInput): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.outstanding_amount !== undefined) {
      fields.push('outstanding_amount = ?');
      values.push(updates.outstanding_amount);
    }
    if (updates.value_eur !== undefined) {
      fields.push('value_eur = ?');
      values.push(updates.value_eur);
    }

    if (fields.length === 0) return;

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE liability_balances SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  deleteLiabilityBalance(id: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM liability_balances WHERE id = ?
    `);

    stmt.run(id);
  }
}
