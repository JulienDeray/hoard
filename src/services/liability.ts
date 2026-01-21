/**
 * Liability Service
 *
 * Pure service functions for managing liabilities.
 * No CLI dependencies - accepts plain data, returns plain data, throws typed errors.
 */

import type { LedgerRepository } from '../database/ledger.js';
import type {
  Liability,
  CreateLiabilityInput,
  UpdateLiabilityInput,
} from '../models/index.js';
import { LiabilityNotFoundError } from '../errors/index.js';

// ============================================================================
// DTOs / Return types
// ============================================================================

export interface CreateLiabilityResult {
  liability: Liability;
}

export interface UpdateLiabilityResult {
  liability: Liability;
}

// ============================================================================
// Service class
// ============================================================================

export class LiabilityService {
  constructor(private ledgerRepo: LedgerRepository) {}

  // ==========================================================================
  // Read operations
  // ==========================================================================

  /**
   * List all liabilities
   * @param activeOnly - If true, only return active liabilities (default: true)
   */
  listLiabilities(activeOnly: boolean = true): Liability[] {
    return this.ledgerRepo.listLiabilities(activeOnly);
  }

  /**
   * Get a liability by ID
   * @throws LiabilityNotFoundError if liability doesn't exist
   */
  getLiabilityById(id: number): Liability {
    const liability = this.ledgerRepo.getLiabilityById(id);
    if (!liability) {
      throw new LiabilityNotFoundError(id);
    }
    return liability;
  }

  // ==========================================================================
  // Create operations
  // ==========================================================================

  /**
   * Create a new liability
   */
  createLiability(input: CreateLiabilityInput): CreateLiabilityResult {
    const liability = this.ledgerRepo.createLiability(input);
    return { liability };
  }

  // ==========================================================================
  // Update operations
  // ==========================================================================

  /**
   * Update a liability
   * @throws LiabilityNotFoundError if liability doesn't exist
   */
  updateLiability(id: number, input: UpdateLiabilityInput): UpdateLiabilityResult {
    // Verify liability exists
    const existing = this.ledgerRepo.getLiabilityById(id);
    if (!existing) {
      throw new LiabilityNotFoundError(id);
    }

    this.ledgerRepo.updateLiability(id, input);

    // Fetch updated liability
    const liability = this.ledgerRepo.getLiabilityById(id)!;
    return { liability };
  }

  // ==========================================================================
  // Delete operations
  // ==========================================================================

  /**
   * Soft delete a liability (set is_active = false)
   * @throws LiabilityNotFoundError if liability doesn't exist
   */
  deleteLiability(id: number): void {
    // Verify liability exists
    const existing = this.ledgerRepo.getLiabilityById(id);
    if (!existing) {
      throw new LiabilityNotFoundError(id);
    }

    // Soft delete by setting is_active = false
    this.ledgerRepo.updateLiability(id, { is_active: false });
  }
}
