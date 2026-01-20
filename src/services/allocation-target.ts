/**
 * Allocation Target Service
 *
 * Pure service functions for managing allocation targets.
 * No CLI dependencies - accepts plain data, returns plain data, throws typed errors.
 */

import type { LedgerRepository } from '../database/ledger.js';
import type { AllocationTarget, CreateAllocationTargetInput } from '../models/index.js';
import {
  AllocationTargetsSumError,
  DuplicateAllocationTargetError,
  NoAllocationTargetsError,
} from '../errors/index.js';

// ============================================================================
// DTOs / Return types
// ============================================================================

export interface AllocationTargetValidation {
  valid: boolean;
  sum: number;
  errors: string[];
}

export interface SetTargetsResult {
  targets: AllocationTarget[];
  validation: AllocationTargetValidation;
}

// ============================================================================
// Service class
// ============================================================================

export class AllocationTargetService {
  constructor(private ledgerRepo: LedgerRepository) {}

  /**
   * List all allocation targets
   */
  listTargets(): AllocationTarget[] {
    return this.ledgerRepo.listAllocationTargets();
  }

  /**
   * Check if any allocation targets exist
   */
  hasTargets(): boolean {
    return this.ledgerRepo.listAllocationTargets().length > 0;
  }

  /**
   * Validate current allocation targets from the database
   */
  validateTargets(): AllocationTargetValidation {
    return this.ledgerRepo.validateAllocationTargets();
  }

  /**
   * Validate a list of targets before saving
   * @param targets - The targets to validate
   * @param allowInvalidSum - If true, returns validation result instead of throwing
   * @throws DuplicateAllocationTargetError if duplicate target keys found
   * @throws AllocationTargetsSumError if sum != 100 and allowInvalidSum is false
   */
  validateTargetList(
    targets: CreateAllocationTargetInput[],
    allowInvalidSum = false
  ): AllocationTargetValidation {
    const errors: string[] = [];

    // Check for duplicates
    const seen = new Set<string>();
    for (const target of targets) {
      if (seen.has(target.target_key)) {
        throw new DuplicateAllocationTargetError(target.target_key);
      }
      seen.add(target.target_key);
    }

    // Calculate sum
    const sum = targets.reduce((acc, t) => acc + t.target_percentage, 0);

    // Check sum
    if (Math.abs(sum - 100) > 0.01) {
      errors.push(`Allocation targets sum to ${sum.toFixed(2)}%, must equal 100%`);

      if (!allowInvalidSum) {
        throw new AllocationTargetsSumError(sum);
      }
    }

    return {
      valid: errors.length === 0,
      sum,
      errors,
    };
  }

  /**
   * Set allocation targets (replaces all existing targets)
   * @param options.targets - The targets to set
   * @param options.allowInvalidSum - If true, allows targets that don't sum to 100%
   * @throws DuplicateAllocationTargetError if duplicate target keys found
   * @throws AllocationTargetsSumError if sum != 100 and allowInvalidSum is false
   */
  setTargets(options: {
    targets: CreateAllocationTargetInput[];
    allowInvalidSum?: boolean;
  }): SetTargetsResult {
    const { targets, allowInvalidSum = false } = options;

    // Validate first
    const validation = this.validateTargetList(targets, allowInvalidSum);

    // Save targets
    this.ledgerRepo.setAllocationTargets(targets);

    // Return the saved targets
    const savedTargets = this.ledgerRepo.listAllocationTargets();

    return {
      targets: savedTargets,
      validation,
    };
  }

  /**
   * Clear all allocation targets
   * @returns The number of targets that were cleared
   * @throws NoAllocationTargetsError if no targets exist
   */
  clearTargets(): number {
    const existingTargets = this.ledgerRepo.listAllocationTargets();

    if (existingTargets.length === 0) {
      throw new NoAllocationTargetsError();
    }

    const count = existingTargets.length;
    this.ledgerRepo.setAllocationTargets([]);

    return count;
  }

  /**
   * Calculate remaining percentage from a partial list of targets
   * Useful for interactive target entry
   */
  calculateRemainingPercentage(targets: Array<{ target_percentage: number }>): number {
    const sum = targets.reduce((acc, t) => acc + t.target_percentage, 0);
    return Math.max(0, 100 - sum);
  }

  /**
   * Get existing targets for display (for confirming replacement)
   * @returns The existing targets or null if none exist
   */
  getExistingTargetsForDisplay(): AllocationTarget[] | null {
    const targets = this.ledgerRepo.listAllocationTargets();
    return targets.length > 0 ? targets : null;
  }
}
