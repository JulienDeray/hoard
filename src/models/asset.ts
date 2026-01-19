export type AssetClass = 'CRYPTO' | 'FIAT' | 'STOCK' | 'REAL_ESTATE' | 'COMMODITY' | 'OTHER';
export type ValuationSource = 'CMC' | 'MANUAL' | 'YAHOO' | 'CUSTOM_API';

export interface Asset {
  id: number;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  valuation_source: ValuationSource;
  external_id?: string; // Was cmc_id (number), now generic string
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAssetInput {
  symbol: string;
  name: string;
  asset_class?: AssetClass;
  valuation_source?: ValuationSource;
  external_id?: string;
  currency?: string;
}

export interface UpdateAssetInput {
  name?: string;
  asset_class?: AssetClass;
  valuation_source?: ValuationSource;
  external_id?: string;
  currency?: string;
  is_active?: boolean;
}

// Legacy support - maps old cmc_id to external_id
export interface LegacyCreateAssetInput {
  symbol: string;
  name: string;
  cmc_id?: number;
}
