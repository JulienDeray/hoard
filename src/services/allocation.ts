import type { LedgerRepository } from '../database/ledger.js';
import type { PortfolioService } from './portfolio.js';
import type {
  AllocationSummary,
  AllocationComparison,
  RebalancingSuggestion,
  RebalancingAction,
} from '../models/index.js';

export class AllocationService {
  constructor(
    private ledgerRepo: LedgerRepository,
    private portfolioService: PortfolioService
  ) {}

  async getAllocationSummary(date?: string): Promise<AllocationSummary | null> {
    // Get portfolio value with holdings
    const portfolio = await this.portfolioService.getPortfolioValue(date);
    if (!portfolio) return null;

    // Get allocation targets
    const targets = this.ledgerRepo.listAllocationTargets();
    const targetsMap = new Map(targets.map((t) => [t.asset_symbol, t.target_percentage]));

    // Validate targets sum to 100%
    const validation = this.ledgerRepo.validateAllocationTargets();

    // Calculate current allocations
    const allocations: AllocationComparison[] = [];
    const totalValue = portfolio.totalValue;

    // Track which assets are explicitly targeted
    const explicitAssets = new Set(
      targets.filter((t) => t.asset_symbol !== 'OTHER').map((t) => t.asset_symbol)
    );

    // Process explicitly targeted assets and non-targeted assets
    for (const holding of portfolio.holdings) {
      const currentValue = holding.current_value_eur || 0;
      const currentPercentage = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;

      if (targetsMap.has(holding.asset_symbol)) {
        // Explicitly targeted asset
        const targetPercentage = targetsMap.get(holding.asset_symbol)!;
        const diffPercentage = currentPercentage - targetPercentage;
        const diffValue = totalValue > 0 ? (diffPercentage / 100) * totalValue : 0;

        allocations.push({
          asset_symbol: holding.asset_symbol,
          asset_name: holding.asset_name,
          current_value: currentValue,
          current_percentage: currentPercentage,
          target_percentage: targetPercentage,
          difference_percentage: diffPercentage,
          difference_value: diffValue,
        });
      } else if (!targetsMap.has('OTHER')) {
        // No targets set for this asset and no OTHER category
        // Show it with 0% target
        allocations.push({
          asset_symbol: holding.asset_symbol,
          asset_name: holding.asset_name,
          current_value: currentValue,
          current_percentage: currentPercentage,
          target_percentage: 0,
          difference_percentage: currentPercentage,
          difference_value: currentValue,
        });
      }
      // If OTHER exists but asset not explicit, skip it for now (will be grouped below)
    }

    // Handle OTHER category (wildcard)
    if (targetsMap.has('OTHER')) {
      const otherHoldings = portfolio.holdings.filter(
        (h) => !explicitAssets.has(h.asset_symbol)
      );
      const otherValue = otherHoldings.reduce((sum, h) => sum + (h.current_value_eur || 0), 0);
      const otherPercentage = totalValue > 0 ? (otherValue / totalValue) * 100 : 0;
      const targetPercentage = targetsMap.get('OTHER')!;

      const diffPercentage = otherPercentage - targetPercentage;
      const diffValue = totalValue > 0 ? (diffPercentage / 100) * totalValue : 0;

      allocations.push({
        asset_symbol: 'OTHER',
        asset_name: `Other Assets (${otherHoldings.length})`,
        current_value: otherValue,
        current_percentage: otherPercentage,
        target_percentage: targetPercentage,
        difference_percentage: diffPercentage,
        difference_value: diffValue,
      });
    }

    // Add assets with targets but zero holdings
    for (const target of targets) {
      if (target.asset_symbol === 'OTHER') continue;
      if (!portfolio.holdings.find((h) => h.asset_symbol === target.asset_symbol)) {
        allocations.push({
          asset_symbol: target.asset_symbol,
          asset_name: target.asset_symbol, // Could look up from assets table
          current_value: 0,
          current_percentage: 0,
          target_percentage: target.target_percentage,
          difference_percentage: -target.target_percentage,
          difference_value: -(target.target_percentage / 100) * totalValue,
        });
      }
    }

    return {
      date: portfolio.date,
      total_value: totalValue,
      currency: portfolio.currency,
      allocations,
      has_targets: targets.length > 0,
      targets_sum_valid: validation.valid,
    };
  }

  async getRebalancingSuggestions(
    date?: string,
    tolerance: number = 2 // tolerance in percentage points
  ): Promise<RebalancingSuggestion | null> {
    const summary = await this.getAllocationSummary(date);
    if (!summary || !summary.has_targets) return null;

    const actions: RebalancingAction[] = [];
    let isBalanced = true;

    for (const allocation of summary.allocations) {
      const absDiff = Math.abs(allocation.difference_percentage);

      let action: 'buy' | 'sell' | 'hold';
      let amountEur: number;

      if (absDiff <= tolerance) {
        action = 'hold';
        amountEur = 0;
      } else if (allocation.difference_percentage < 0) {
        // Underweight - need to buy
        action = 'buy';
        amountEur = Math.abs(allocation.difference_value);
        isBalanced = false;
      } else {
        // Overweight - need to sell
        action = 'sell';
        amountEur = allocation.difference_value;
        isBalanced = false;
      }

      actions.push({
        asset_symbol: allocation.asset_symbol,
        asset_name: allocation.asset_name,
        action,
        amount_eur: amountEur,
        current_percentage: allocation.current_percentage,
        target_percentage: allocation.target_percentage,
      });
    }

    return {
      date: summary.date,
      total_value: summary.total_value,
      currency: summary.currency,
      actions,
      is_balanced: isBalanced,
    };
  }
}
