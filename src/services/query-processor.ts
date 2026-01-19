import { ClaudeService } from './claude.js';
import { PortfolioService } from './portfolio.js';
import { AllocationService } from './allocation.js';
import { LedgerRepository } from '../database/ledger.js';
import { RatesRepository } from '../database/rates.js';
import { Logger } from '../utils/logger.js';

export class QueryProcessor {
  constructor(
    private claudeService: ClaudeService,
    private portfolioService: PortfolioService,
    private ledgerRepo: LedgerRepository,
    private ratesRepo: RatesRepository,
    private allocationService: AllocationService
  ) {}

  async processQuery(userQuery: string): Promise<string> {
    try {
      const toolExecutor = async (toolName: string, toolInput: any): Promise<any> => {
        Logger.debug(`Executing tool: ${toolName} with input: ${JSON.stringify(toolInput)}`);

        switch (toolName) {
          case 'get_holdings':
            return await this.getHoldings(toolInput.date);

          case 'calculate_portfolio_value':
            return await this.calculatePortfolioValue(toolInput.date);

          case 'get_historical_price':
            return await this.getHistoricalPrice(toolInput.symbol, toolInput.date);

          case 'list_snapshots':
            return this.listSnapshots();

          case 'suggest_rebalancing':
            return await this.suggestRebalancing(toolInput.date, toolInput.tolerance);

          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
      };

      const response = await this.claudeService.processQuery(userQuery, toolExecutor);
      return response;
    } catch (error) {
      Logger.error(
        `Query processing failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async getHoldings(date?: string): Promise<any> {
    if (date) {
      const snapshot = this.ledgerRepo.getSnapshotByDate(date);
      if (!snapshot) {
        return { error: `No snapshot found for date: ${date}` };
      }

      const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
      return {
        date: snapshot.date,
        holdings: holdings.map((h) => ({
          asset: h.asset_symbol,
          name: h.asset_name,
          amount: h.amount,
          value_eur: h.value_eur,
        })),
      };
    } else {
      const snapshot = this.ledgerRepo.getLatestSnapshot();
      if (!snapshot) {
        return { error: 'No snapshots found' };
      }

      const holdings = this.ledgerRepo.getHoldingsBySnapshotId(snapshot.id);
      return {
        date: snapshot.date,
        holdings: holdings.map((h) => ({
          asset: h.asset_symbol,
          name: h.asset_name,
          amount: h.amount,
          value_eur: h.value_eur,
        })),
      };
    }
  }

  private async calculatePortfolioValue(date?: string): Promise<any> {
    const summary = await this.portfolioService.getPortfolioValue(date || undefined);

    if (!summary) {
      return { error: date ? `No data found for date: ${date}` : 'No portfolio data found' };
    }

    return {
      date: summary.date,
      total_value: summary.totalValue,
      currency: summary.currency,
      breakdown: summary.holdings.map((h) => ({
        asset: h.asset_symbol,
        name: h.asset_name,
        amount: h.amount,
        price: h.current_price_eur,
        value: h.current_value_eur,
      })),
    };
  }

  private async getHistoricalPrice(symbol: string, date: string): Promise<any> {
    const rate = this.ratesRepo.getHistoricalRate(symbol, date);

    if (!rate) {
      return {
        error: `No historical price found for ${symbol} on ${date}`,
      };
    }

    return {
      asset: symbol,
      date,
      price: rate.price,
      currency: rate.base_currency,
    };
  }

  private listSnapshots(): any {
    const snapshots = this.ledgerRepo.listSnapshots();

    if (snapshots.length === 0) {
      return { error: 'No snapshots found' };
    }

    return {
      count: snapshots.length,
      snapshots: snapshots.map((s) => ({
        date: s.date,
        notes: s.notes,
        created_at: s.created_at,
        total_assets_eur: s.total_assets_eur,
        net_worth_eur: s.net_worth_eur,
      })),
    };
  }

  private async suggestRebalancing(date?: string, tolerance?: number): Promise<any> {
    const suggestions = await this.allocationService.getRebalancingSuggestions(
      date || undefined,
      tolerance || 2
    );

    if (!suggestions) {
      return {
        error: 'No allocation targets set or no portfolio data available',
      };
    }

    return {
      date: suggestions.date,
      total_value: suggestions.total_value,
      currency: suggestions.currency,
      is_balanced: suggestions.is_balanced,
      actions: suggestions.actions.map((action) => ({
        asset: action.target_key,
        name: action.display_name,
        action: action.action,
        amount_eur: action.amount_eur,
        current_percentage: action.current_percentage,
        target_percentage: action.target_percentage,
        difference_percentage: action.current_percentage - action.target_percentage,
      })),
    };
  }
}
