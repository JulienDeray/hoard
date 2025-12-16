export interface Asset {
  symbol: string;
  name: string;
  cmc_id?: number; // CoinMarketCap ID
  last_updated?: string;
  is_active: boolean;
}

export interface CreateAssetInput {
  symbol: string;
  name: string;
  cmc_id?: number;
}
