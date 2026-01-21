/**
 * Service layer error classes
 *
 * These errors are thrown by service functions and should be caught by CLI commands
 * to display user-friendly messages. Each error has a unique code for programmatic handling.
 */

// Base class for all service errors
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ============================================================================
// Snapshot-related errors
// ============================================================================

export class SnapshotNotFoundError extends ServiceError {
  constructor(public readonly date: string) {
    super(`No snapshot found for ${date}`, 'SNAPSHOT_NOT_FOUND');
  }
}

export class SnapshotAlreadyExistsError extends ServiceError {
  constructor(
    public readonly date: string,
    public readonly holdingsCount: number
  ) {
    super(
      `Snapshot already exists for ${date} with ${holdingsCount} holding(s)`,
      'SNAPSHOT_ALREADY_EXISTS'
    );
  }
}

// ============================================================================
// Asset-related errors
// ============================================================================

export class AssetNotFoundError extends ServiceError {
  constructor(public readonly symbol: string) {
    super(`Asset ${symbol} not found in database`, 'ASSET_NOT_FOUND');
  }
}

export class AssetDiscoveryError extends ServiceError {
  constructor(
    public readonly symbol: string,
    public readonly reason: string
  ) {
    super(`Could not discover asset ${symbol}: ${reason}`, 'ASSET_DISCOVERY_FAILED');
  }
}

// ============================================================================
// Holding-related errors
// ============================================================================

export class HoldingNotFoundError extends ServiceError {
  constructor(
    public readonly symbol: string,
    public readonly snapshotDate: string
  ) {
    super(`Holding ${symbol} not found in snapshot ${snapshotDate}`, 'HOLDING_NOT_FOUND');
  }
}

// ============================================================================
// Validation errors
// ============================================================================

export class InvalidDateError extends ServiceError {
  constructor(public readonly date: string) {
    super(`Invalid date format: ${date}. Use YYYY-MM-DD`, 'INVALID_DATE');
  }
}

export class InvalidAmountError extends ServiceError {
  constructor(public readonly amount: number) {
    super(`Invalid amount: ${amount}. Must be a positive number`, 'INVALID_AMOUNT');
  }
}

// ============================================================================
// Allocation-related errors
// ============================================================================

export class AllocationTargetsSumError extends ServiceError {
  constructor(public readonly sum: number) {
    super(
      `Allocation targets sum to ${sum.toFixed(2)}%, must equal 100%`,
      'ALLOCATION_TARGETS_SUM_INVALID'
    );
  }
}

export class DuplicateAllocationTargetError extends ServiceError {
  constructor(public readonly targetKey: string) {
    super(`Duplicate allocation target: ${targetKey}`, 'DUPLICATE_ALLOCATION_TARGET');
  }
}

export class NoAllocationTargetsError extends ServiceError {
  constructor() {
    super('No allocation targets set', 'NO_ALLOCATION_TARGETS');
  }
}

// ============================================================================
// Portfolio-related errors
// ============================================================================

export class NoPortfolioDataError extends ServiceError {
  constructor(public readonly date?: string) {
    super(
      date ? `No portfolio data found for ${date}` : 'No portfolio data found',
      'NO_PORTFOLIO_DATA'
    );
  }
}

// ============================================================================
// Price/Rate errors
// ============================================================================

export class PriceFetchError extends ServiceError {
  constructor(
    public readonly symbol: string,
    public readonly reason: string
  ) {
    super(`Could not fetch price for ${symbol}: ${reason}`, 'PRICE_FETCH_FAILED');
  }
}

// ============================================================================
// Liability-related errors
// ============================================================================

export class LiabilityNotFoundError extends ServiceError {
  constructor(public readonly id: number) {
    super(`Liability with ID ${id} not found`, 'LIABILITY_NOT_FOUND');
  }
}

export class LiabilityBalanceNotFoundError extends ServiceError {
  constructor(
    public readonly snapshotDate: string,
    public readonly liabilityId: number
  ) {
    super(
      `Liability balance not found for liability ${liabilityId} in snapshot ${snapshotDate}`,
      'LIABILITY_BALANCE_NOT_FOUND'
    );
  }
}
