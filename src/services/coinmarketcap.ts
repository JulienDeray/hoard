import axios, { AxiosInstance } from 'axios';

interface CMCQuoteResponse {
  data: {
    [symbol: string]: {
      quote: {
        [currency: string]: {
          price: number;
          volume_24h: number;
          market_cap: number;
          last_updated: string;
        };
      };
    };
  };
}

interface CMCHistoricalResponse {
  data: {
    quotes: Array<{
      timestamp: string;
      quote: {
        [currency: string]: {
          price: number;
          volume_24h: number;
          market_cap: number;
        };
      };
    }>;
  };
}

interface PriceData {
  price: number;
  volume_24h?: number;
  market_cap?: number;
  timestamp: string;
}

export interface AssetInfo {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  currentPrice?: number;
  marketCap?: number;
}

export class CoinMarketCapService {
  private client: AxiosInstance;
  private requestQueue: Promise<any> = Promise.resolve();
  private requestDelay = 1000; // 1 second between requests (conservative for free tier)

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://pro-api.coinmarketcap.com',
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        Accept: 'application/json',
      },
    });
  }

  private async queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    const currentRequest = this.requestQueue.then(async () => {
      const result = await fn();
      await this.delay(this.requestDelay);
      return result;
    });

    this.requestQueue = currentRequest.catch(() => {
      // Ignore errors in queue chain
    });

    return currentRequest;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getCurrentPrice(symbol: string, baseCurrency = 'EUR'): Promise<number> {
    return this.queueRequest(async () => {
      const response = await this.client.get<CMCQuoteResponse>(
        '/v2/cryptocurrency/quotes/latest',
        {
          params: {
            symbol,
            convert: baseCurrency,
          },
        }
      );

      const data = response.data.data[symbol];
      if (!data) {
        throw new Error(`No data found for symbol: ${symbol}`);
      }

      // Handle both array and single object responses
      const quoteData = Array.isArray(data) ? data[0] : data;

      if (!quoteData || !quoteData.quote || !quoteData.quote[baseCurrency]) {
        throw new Error(`No quote data available for ${symbol} in ${baseCurrency}`);
      }

      return quoteData.quote[baseCurrency].price;
    });
  }

  async getCurrentPriceData(symbol: string, baseCurrency = 'EUR'): Promise<PriceData> {
    return this.queueRequest(async () => {
      const response = await this.client.get<CMCQuoteResponse>(
        '/v2/cryptocurrency/quotes/latest',
        {
          params: {
            symbol,
            convert: baseCurrency,
          },
        }
      );

      const data = response.data.data[symbol];
      if (!data) {
        throw new Error(`No data found for symbol: ${symbol}`);
      }

      // Handle both array and single object responses
      const quoteData = Array.isArray(data) ? data[0] : data;

      if (!quoteData || !quoteData.quote || !quoteData.quote[baseCurrency]) {
        throw new Error(`No quote data available for ${symbol} in ${baseCurrency}`);
      }

      const quote = quoteData.quote[baseCurrency];
      return {
        price: quote.price,
        volume_24h: quote.volume_24h,
        market_cap: quote.market_cap,
        timestamp: quote.last_updated,
      };
    });
  }

  async getMultipleCurrentPrices(
    symbols: string[],
    baseCurrency = 'EUR'
  ): Promise<Map<string, number>> {
    return this.queueRequest(async () => {
      const response = await this.client.get<CMCQuoteResponse>(
        '/v2/cryptocurrency/quotes/latest',
        {
          params: {
            symbol: symbols.join(','),
            convert: baseCurrency,
          },
        }
      );

      const prices = new Map<string, number>();
      for (const symbol of symbols) {
        const data = response.data.data[symbol];
        if (data) {
          // Handle both array and single object responses
          const quoteData = Array.isArray(data) ? data[0] : data;
          if (quoteData && quoteData.quote && quoteData.quote[baseCurrency]) {
            prices.set(symbol, quoteData.quote[baseCurrency].price);
          }
        }
      }

      return prices;
    });
  }

  async getHistoricalPrice(
    symbol: string,
    date: Date,
    baseCurrency = 'EUR'
  ): Promise<number | undefined> {
    return this.queueRequest(async () => {
      // Format date as YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0];

      const response = await this.client.get<CMCHistoricalResponse>(
        '/v2/cryptocurrency/quotes/historical',
        {
          params: {
            symbol,
            time_start: dateStr,
            time_end: dateStr,
            convert: baseCurrency,
            count: 1,
          },
        }
      );

      const quotes = response.data.data.quotes;
      if (!quotes || quotes.length === 0) {
        return undefined;
      }

      return quotes[0].quote[baseCurrency].price;
    });
  }

  async backfillHistoricalRates(
    symbol: string,
    startDate: Date,
    endDate: Date,
    baseCurrency = 'EUR'
  ): Promise<PriceData[]> {
    return this.queueRequest(async () => {
      const response = await this.client.get<CMCHistoricalResponse>(
        '/v2/cryptocurrency/quotes/historical',
        {
          params: {
            symbol,
            time_start: startDate.toISOString(),
            time_end: endDate.toISOString(),
            convert: baseCurrency,
            interval: 'daily',
          },
        }
      );

      const quotes = response.data.data.quotes;
      if (!quotes) {
        return [];
      }

      return quotes.map((q) => ({
        price: q.quote[baseCurrency].price,
        volume_24h: q.quote[baseCurrency].volume_24h,
        market_cap: q.quote[baseCurrency].market_cap,
        timestamp: q.timestamp,
      }));
    });
  }

  async getAssetInfoBySymbol(symbol: string, baseCurrency = 'EUR'): Promise<AssetInfo | null> {
    return this.queueRequest(async () => {
      try {
        // Get both metadata and current price in parallel
        const [infoResponse, quoteResponse] = await Promise.all([
          this.client.get('/v2/cryptocurrency/info', {
            params: { symbol },
          }),
          this.client.get<CMCQuoteResponse>('/v2/cryptocurrency/quotes/latest', {
            params: { symbol, convert: baseCurrency },
          }),
        ]);

        const infoData = infoResponse.data.data[symbol];
        if (!infoData) {
          return null;
        }

        // Handle both array and single object responses
        const info = Array.isArray(infoData) ? infoData[0] : infoData;

        const quoteData = quoteResponse.data.data[symbol];
        const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData;

        return {
          id: info.id,
          name: info.name,
          symbol: info.symbol,
          slug: info.slug,
          currentPrice: quote?.quote?.[baseCurrency]?.price,
          marketCap: quote?.quote?.[baseCurrency]?.market_cap,
        };
      } catch {
        return null;
      }
    });
  }

  async getAssetInfoById(cmcId: number, baseCurrency = 'EUR'): Promise<AssetInfo | null> {
    return this.queueRequest(async () => {
      try {
        // Get both metadata and current price
        const [infoResponse, quoteResponse] = await Promise.all([
          this.client.get('/v2/cryptocurrency/info', {
            params: { id: cmcId },
          }),
          this.client.get<CMCQuoteResponse>('/v2/cryptocurrency/quotes/latest', {
            params: { id: cmcId, convert: baseCurrency },
          }),
        ]);

        const infoData = infoResponse.data.data[cmcId];
        if (!infoData) {
          return null;
        }

        const quoteData = Object.values(quoteResponse.data.data)[0] as any;

        return {
          id: infoData.id,
          name: infoData.name,
          symbol: infoData.symbol,
          slug: infoData.slug,
          currentPrice: quoteData?.quote?.[baseCurrency]?.price,
          marketCap: quoteData?.quote?.[baseCurrency]?.market_cap,
        };
      } catch {
        return null;
      }
    });
  }
}
