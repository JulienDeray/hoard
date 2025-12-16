export interface HistoricalRate {
  id: number;
  asset_symbol: string;
  base_currency: string;
  price: number;
  timestamp: string; // ISO 8601 format
  volume_24h?: number;
  market_cap?: number;
  source: string;
}

export interface RateCache {
  asset_symbol: string;
  base_currency: string;
  price: number;
  last_updated: string;
}

export interface SaveRateInput {
  asset_symbol: string;
  base_currency?: string;
  price: number;
  timestamp: string;
  volume_24h?: number;
  market_cap?: number;
  source?: string;
}
